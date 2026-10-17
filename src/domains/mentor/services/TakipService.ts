// src/domains/mentor/services/TakipService.ts
import { requireAbility } from '@/src/shared/authorization/server'
import { logger } from '@/src/infrastructure/observability/logger'
import { getCurrentProfile } from '@/src/shared/auth'
import { HomeworkService } from '@/src/domains/homework/services/HomeworkService'
import { TakipRepository as R } from '../repositories/TakipRepository'
import { kaydetSchema } from '../validators/takip'
import type { Json } from '@/src/infrastructure/supabase/database.types'
import { MATEMATIK_KONULARI } from '../takip/sablonlar'
import {
  yeniHafta, planKopyala, ozetHesapla, okulOdevBolumleri, dersDogruluk, BOS_GORUSME,
  type HaftaVerisi, type Icerik, type Gorusme, type Ozet, type Seviye, type OkulOdevBolumleri, type Okuma,
} from '../takip/takipMath'

export type SayfaVerisi = {
  ogrenci: { id: string; ad: string; sinifAdi: string; sinif: number; classId: string; veliTelefon: string | null }
  hafta: string
  kayit: { veri: HaftaVerisi; updatedAt: string; kapaliAt: string | null } | null
  taslak: HaftaVerisi
  onceki: { ozet: Ozet; hedef: string } | null
  kitaplar: { id: string; ad: string; ders: string }[]
  /** Ödev modülünden salt okunur: tamamlanmamış (yapılmadı, teslimi geçmiş) · bu hafta · gelecek hafta */
  okulOdevleri: OkulOdevBolumleri
  konular: { id: string; ders: string; ad: string; grup: string | null }[]
  /** konu_id → 0 başlanmadı / 1 çalışılıyor / 2 oturdu (satırı olmayan = 0) */
  konuDurumu: Record<string, number>
  /** yalnız Öğrenci dosyası sekmesinde dolu (gecmis: true) */
  gecmis: { hafta: string; seviye: Seviye; ozet: Ozet; okuma: Okuma | null; dersler: ReturnType<typeof dersDogruluk>; kapali: boolean }[]
  mentorAdi: string
  okulAdi: string
}

type Satir = NonNullable<Awaited<ReturnType<typeof R.hafta>>>
const veriOf = (s: Satir): HaftaVerisi => ({
  seviye: s.seviye as Seviye, soruHedefi: s.soru_hedefi,
  icerik: s.icerik as unknown as Icerik, gorusme: { ...BOS_GORUSME, ...(s.gorusme as unknown as Partial<Gorusme>) },
})
const ozetOf = (s: Satir): Ozet => ({
  gorev_toplam: s.gorev_toplam, gorev_yapilan: s.gorev_yapilan, soru: s.soru, dogru: s.dogru, okuma_sayfa: s.okuma_sayfa, islendi: s.islendi,
})

/** Bayrak + güncel mentörlük; ikisi de sunucuda (RLS de aynısını ister). */
async function yetki(studentId: string) {
  const ab = await requireAbility()
  if (!(await R.acikMi()) || !(await R.mentoruMu(ab.userId, ab.schoolId, studentId))) return null
  return ab
}

export const TakipService = {
  acikMi: () => R.acikMi(),

  async sayfaVerisi(studentId: string, hafta: string, { gecmis = false }: { gecmis?: boolean } = {}): Promise<SayfaVerisi | null> {
    const ab = await yetki(studentId)
    if (!ab) return null
    const o = await R.ogrenci(ab.schoolId, studentId)
    if (!o) return null
    const sinifBilgi = o.classes as { name: string; grade: number } | null
    const sinif = sinifBilgi?.grade ?? 9
    const [kayit, onceki, kitaplar, profil, profile, durumlar, gecmisSat] = await Promise.all([
      R.hafta(ab.schoolId, studentId, hafta),
      R.oncekiHafta(ab.schoolId, studentId, hafta),
      R.kitaplar(ab.schoolId, studentId),
      HomeworkService.getStudentHomeworkProfile(studentId, o.class_id, { tumOdevler: true }),
      getCurrentProfile(),
      R.konuDurumlari(ab.schoolId, studentId),
      gecmis ? R.gecmis(ab.schoolId, studentId) : Promise.resolve([]),
    ])
    if ('error' in profil) throw new Error(profil.error)
    let konular = await R.konular(ab.schoolId, sinif)
    // Matematik listesi yalnız okulda o sınıf için hiç yoksa tohumlanır (her açılışta yazma yok). Konu önerisi
    // yardımcıdır: tohum yazılamazsa sayfa yine açılır, hata loglanır (2026-10-17 tarama).
    if (sinif in MATEMATIK_KONULARI && !konular.some(k => k.ders === 'Matematik')) {
      try {
        await R.konuTohumla(ab.schoolId, ab.userId, sinif, MATEMATIK_KONULARI[sinif as 9])
        konular = await R.konular(ab.schoolId, sinif)
      } catch (e) {
        logger.warn({ event: 'mentor_takip_konu_tohum_failed', userId: ab.userId, err: e instanceof Error ? e.message : String(e) }, 'Matematik konu listesi tohumlanamadı')
      }
    }
    return {
      ogrenci: { id: o.id, ad: o.full_name, sinifAdi: sinifBilgi?.name ?? '—', sinif, classId: o.class_id, veliTelefon: o.veli_telefon },
      hafta,
      kayit: kayit ? { veri: veriOf(kayit), updatedAt: kayit.updated_at, kapaliAt: kayit.kapali_at } : null,
      // Kayıt yoksa taslak gösterilir; satır ilk düzenlemede oluşur (yalnız bakmak "Plan yok"u bozmaz)
      taslak: kayit ? veriOf(kayit) : yeniHafta(onceki ? veriOf(onceki) : null, sinif),
      onceki: onceki ? { ozet: ozetOf(onceki), hedef: veriOf(onceki).gorusme.hedef } : null,
      kitaplar,
      // Kapalı hafta: kapatma anındaki görüntü (öğretmen işareti sonradan değişse de kayıt sabit)
      okulOdevleri: kayit?.kapali_at && kayit.okul_odevleri
        ? kayit.okul_odevleri as unknown as OkulOdevBolumleri : okulOdevBolumleri(profil.homeworks, hafta),
      konular,
      konuDurumu: Object.fromEntries(durumlar.map(r => [r.konu_id, r.durum])),
      gecmis: gecmisSat.map(r => ({
        hafta: r.hafta_basi, seviye: r.seviye as Seviye, okuma: (r.icerik as unknown as Icerik).okuma,
        dersler: dersDogruluk((r.icerik as unknown as Icerik).sonuclar ?? []), kapali: r.kapali_at !== null,
        ozet: { gorev_toplam: r.gorev_toplam, gorev_yapilan: r.gorev_yapilan, soru: r.soru, dogru: r.dogru, okuma_sayfa: r.okuma_sayfa, islendi: r.islendi },
      })),
      mentorAdi: profile?.full_name ?? '',
      okulAdi: profile?.schools?.name ?? '',
    }
  },

  async kaydet(girdi: unknown): Promise<{ error?: string; cakisma?: boolean; updatedAt?: string }> {
    const p = kaydetSchema.safeParse(girdi)
    if (!p.success) return { error: p.error.issues[0]?.message ?? 'Geçersiz veri' }
    const g = p.data
    const ab = await yetki(g.studentId)
    if (!ab) return { error: 'Bu öğrencinin takibine erişiminiz yok.' }
    const satir = {
      school_id: ab.schoolId, student_id: g.studentId, hafta_basi: g.hafta, seviye: g.seviye, soru_hedefi: g.soruHedefi,
      icerik: g.icerik, gorusme: g.gorusme, updated_by: ab.userId, ...ozetHesapla(g.icerik),
    }
    const r = g.sonBilinen === null ? await R.haftaEkle(satir) : await R.haftaGuncelle(satir, g.sonBilinen)
    return 'kapali' in r && r.kapali ? { error: 'Bu hafta kapalı; düzenlemek için kilidi açın.' } : r
  },

  /** Plan + sonuç + o anki okul ödevi durumu sabitlenir. Kayıt yoksa ekranda görülen taslak önce yazılır. */
  async kapat(studentId: string, hafta: string): Promise<{ error?: string }> {
    const ab = await yetki(studentId)
    if (!ab) return { error: 'Bu öğrencinin takibine erişiminiz yok.' }
    const v = await TakipService.sayfaVerisi(studentId, hafta)
    if (!v) return { error: 'Bu öğrencinin takibine erişiminiz yok.' }
    if (v.kayit?.kapaliAt) return {}
    if (!v.kayit) {
      const t = v.taslak
      const r = await R.haftaEkle({
        school_id: ab.schoolId, student_id: studentId, hafta_basi: hafta, seviye: t.seviye, soru_hedefi: t.soruHedefi,
        icerik: t.icerik as unknown as Json, gorusme: t.gorusme as unknown as Json, updated_by: ab.userId, ...ozetHesapla(t.icerik),
      })
      if (r.cakisma) return { error: 'Bu hafta başka bir ekranda değişti; sayfayı yenileyip tekrar deneyin.' }
    }
    await R.haftaKapat(ab.schoolId, studentId, hafta, v.okulOdevleri as unknown as Json)
    return {}
  },

  /** "Geçen haftayı kopyala": en yakın önceki kaydın planı (sayfa kaldığı yerden). Yazmaz — istemci kendi kaydına koyar. */
  async oncekiPlan(studentId: string, hafta: string): Promise<{ error?: string; veri?: HaftaVerisi; kaynak?: string }> {
    const ab = await yetki(studentId)
    if (!ab) return { error: 'Bu öğrencinin takibine erişiminiz yok.' }
    const o = await R.oncekiHafta(ab.schoolId, studentId, hafta)
    if (!o) return { error: 'Önceki haftalarda plan yok.' }
    return { veri: planKopyala(veriOf(o)), kaynak: o.hafta_basi }
  },

  /** Bu haftanın kayıtlı planı (görevler, bağlı kitap ve sayfalar, seviye, hedef, düzen) diğer mentilerin aynı haftasına.
   *  Bu hafta kaydı olan atlanır. Kitap öğrencide ad+ders ile aranır, yoksa tanımlanır. Sonuç/görüşme/okuma taşınmaz. */
  async herkeseUygula(studentId: string, hafta: string): Promise<{ error?: string; uygulanan?: number; atlanan?: number }> {
    const ab = await yetki(studentId)
    if (!ab) return { error: 'Bu öğrencinin takibine erişiminiz yok.' }
    const kaynak = await R.hafta(ab.schoolId, studentId, hafta)
    if (!kaynak) return { error: 'Önce bu haftanın planını kaydedin (bir alanı değiştirin).' }
    const k = veriOf(kaynak)
    const kaynakDers = new Map((await R.kitaplar(ab.schoolId, studentId)).map(x => [x.id, x.ders]))
    const hedefler = (await R.mentiler(ab.userId, ab.schoolId)).filter(id => id !== studentId)
    const dolu = new Set((await R.durumlar(ab.schoolId, hedefler, hafta)).map(r => r.student_id))
    let uygulanan = 0
    for (const hedef of hedefler.filter(id => !dolu.has(id))) {
      const mevcut = await R.kitaplar(ab.schoolId, hedef)
      const esle = new Map<string, string>()
      for (const g of k.icerik.gorevler) {
        if (!g.kitapId || esle.has(g.kitapId)) continue
        const ad = g.kitapAdi ?? '', ders = kaynakDers.get(g.kitapId) ?? ''
        const var_ = mevcut.find(x => x.ad === ad && x.ders === ders)
        if (var_) { esle.set(g.kitapId, var_.id); continue }
        const { data, error } = await R.kitapEkle(ab.schoolId, hedef, ad, ders)
        if (error || !data) throw new Error(error?.message ?? 'Kitap tanımlanamadı')
        mevcut.push(data); esle.set(g.kitapId, data.id)
      }
      const icerik = {
        duzen: k.icerik.duzen, mentorOdevleri: [], okuma: null,
        gorevler: k.icerik.gorevler.map(g => ({ ...g, yapti: false, soru: null, dogru: null, ...(g.kitapId && { kitapId: esle.get(g.kitapId)! }) })),
      }
      const r = await R.haftaEkle({
        school_id: ab.schoolId, student_id: hedef, hafta_basi: hafta, seviye: k.seviye, soru_hedefi: k.soruHedefi,
        icerik: icerik as unknown as Json, gorusme: BOS_GORUSME as unknown as Json, updated_by: ab.userId, ...ozetHesapla(icerik),
      })
      if (!r.cakisma) uygulanan++ // bu arada başka ekrandan plan yazıldıysa dokunulmaz
    }
    return { uygulanan, atlanan: dolu.size }
  },

  async kilidiAc(studentId: string, hafta: string): Promise<{ error?: string }> {
    const ab = await yetki(studentId)
    if (!ab) return { error: 'Bu öğrencinin takibine erişiminiz yok.' }
    await R.kilidiAc(ab.schoolId, studentId, hafta)
    return {}
  },

  async kitapEkle(studentId: string, ad: string, ders: string) {
    const ab = await yetki(studentId)
    if (!ab) return { error: 'Bu öğrencinin takibine erişiminiz yok.' }
    const { data, error } = await R.kitapEkle(ab.schoolId, studentId, ad, ders)
    return error ? { error: 'Kitap eklenemedi.' } : { kitap: data }
  },

  async kitapSil(studentId: string, kitapId: string) {
    const ab = await yetki(studentId)
    if (!ab) return { error: 'Bu öğrencinin takibine erişiminiz yok.' }
    const { error } = await R.kitapSil(ab.schoolId, studentId, kitapId)
    return error ? { error: 'Kitap silinemedi.' } : {}
  },

  async konuEkle(studentId: string, ders: string, ad: string) {
    const ab = await yetki(studentId)
    if (!ab) return { error: 'Bu öğrencinin takibine erişiminiz yok.' }
    const o = await R.ogrenci(ab.schoolId, studentId)
    const sinif = (o?.classes as { grade: number } | null)?.grade ?? 9
    const { error } = await R.konuEkle(ab.schoolId, ab.userId, ders, sinif, ad)
    return error ? { error: 'Konu eklenemedi.' } : {}
  },
  async konuDurumuYaz(studentId: string, konuId: string, durum: 0 | 1 | 2) {
    const ab = await yetki(studentId)
    if (!ab) return { error: 'Bu öğrencinin takibine erişiminiz yok.' }
    const { error } = await R.konuDurumuYaz(ab.schoolId, studentId, konuId, durum)
    return error ? { error: 'Kaydedilemedi.' } : {}
  },

  async planliOgrenciler(studentIds: string[], hafta: string): Promise<Set<string>> {
    const ab = await requireAbility()
    if (!studentIds.length || !(await R.acikMi())) return new Set()
    return R.planliOgrenciler(ab.schoolId, studentIds, hafta)
  },

  async durumlar(studentIds: string[], hafta: string) {
    const ab = await requireAbility()
    if (!studentIds.length || !(await R.acikMi())) return new Map()
    const rows = await R.durumlar(ab.schoolId, studentIds, hafta)
    return new Map(rows.map(r => [r.student_id, r]))
  },
}
