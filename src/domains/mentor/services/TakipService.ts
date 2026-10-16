// src/domains/mentor/services/TakipService.ts
import { requireAbility } from '@/src/shared/authorization/server'
import { getCurrentProfile } from '@/src/shared/auth'
import { HomeworkService } from '@/src/domains/homework/services/HomeworkService'
import { TakipRepository as R } from '../repositories/TakipRepository'
import { kaydetSchema } from '../validators/takip'
import { MATEMATIK_KONULARI } from '../takip/sablonlar'
import {
  yeniHafta, ozetHesapla, okulOdevleri, BOS_GORUSME,
  type HaftaVerisi, type Icerik, type Gorusme, type Ozet, type Seviye, type OkulOdevi,
} from '../takip/takipMath'

export type SayfaVerisi = {
  ogrenci: { id: string; ad: string; sinifAdi: string; sinif: number; classId: string }
  hafta: string
  kayit: { veri: HaftaVerisi; updatedAt: string } | null
  taslak: HaftaVerisi
  onceki: { ozet: Ozet; hedef: string } | null
  kitaplar: { id: string; ad: string; ders: string }[]
  okulOdevleri: OkulOdevi[]
  konular: { id: string; ders: string; ad: string; grup: string | null }[]
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

  async sayfaVerisi(studentId: string, hafta: string): Promise<SayfaVerisi | null> {
    const ab = await yetki(studentId)
    if (!ab) return null
    const o = await R.ogrenci(ab.schoolId, studentId)
    if (!o) return null
    const sinifBilgi = o.classes as { name: string; grade: number } | null
    const sinif = sinifBilgi?.grade ?? 9
    const [kayit, onceki, kitaplar, profil, profile] = await Promise.all([
      R.hafta(ab.schoolId, studentId, hafta),
      R.oncekiHafta(ab.schoolId, studentId, hafta),
      R.kitaplar(ab.schoolId, studentId),
      HomeworkService.getStudentHomeworkProfile(studentId, o.class_id, { tumOdevler: true }),
      getCurrentProfile(),
    ])
    if ('error' in profil) throw new Error(profil.error)
    if (sinif in MATEMATIK_KONULARI) await R.konuTohumla(ab.schoolId, ab.userId, sinif, MATEMATIK_KONULARI[sinif as 9])
    const konular = await R.konular(ab.schoolId, sinif)
    return {
      ogrenci: { id: o.id, ad: o.full_name, sinifAdi: sinifBilgi?.name ?? '—', sinif, classId: o.class_id },
      hafta,
      kayit: kayit ? { veri: veriOf(kayit), updatedAt: kayit.updated_at } : null,
      // Kayıt yoksa taslak gösterilir; satır ilk düzenlemede oluşur (yalnız bakmak "Plan yok"u bozmaz)
      taslak: kayit ? veriOf(kayit) : yeniHafta(onceki ? veriOf(onceki) : null, sinif),
      onceki: onceki ? { ozet: ozetOf(onceki), hedef: veriOf(onceki).gorusme.hedef } : null,
      kitaplar,
      okulOdevleri: okulOdevleri(profil.homeworks, hafta),
      konular,
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
    return g.sonBilinen === null ? R.haftaEkle(satir) : R.haftaGuncelle(satir, g.sonBilinen)
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

  async durumlar(studentIds: string[], hafta: string) {
    const ab = await requireAbility()
    if (!studentIds.length || !(await R.acikMi())) return new Map()
    const rows = await R.durumlar(ab.schoolId, studentIds, hafta)
    return new Map(rows.map(r => [r.student_id, r]))
  },
}
