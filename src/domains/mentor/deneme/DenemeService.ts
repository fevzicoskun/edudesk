// src/domains/mentor/deneme/DenemeService.ts
import { requireAbility } from '@/src/shared/authorization/server'
import { addDaysISO, todayLocalISO } from '@/src/shared/date'
import { MentorRepository } from '../repositories/MentorRepository'
import { TakipRepository } from '../repositories/TakipRepository'
import { DenemeRepository as R } from '../repositories/DenemeRepository'
import { parseStoys, eslestir, type DenemeTuru, type DersSonucu, type Eslesme } from './stoys'
import { denemeKaydetSema, KAPALI } from './denemeSema'

export type Onizleme = {
  tur: DenemeTuru; seviye: number; sinif: string; sinifId: string; eslesme: Eslesme
  ogrenciAdlari: Record<string, string>; oneri: { sinavId: string; tarih: string } | null
}
export type DenemeOgrenciSonucu = { id: string; ad: string; dersler: DersSonucu[]; toplamNet: number }
export type DenemeListeSatiri = {
  sinavId: string; tur: DenemeTuru; tarih: string; sinif: string; sinifId: string; ogrenciSayisi: number
  /** Öğrenci bazlı net tablosu (satıra tıklayınca açılır) — veli toplantısı kâğıdıyla aynı veri */
  ogrenciler: DenemeOgrenciSonucu[]
}

/** Kapı açık mı + mentörün güncel öğrencileri (sınıf kimliği ve adıyla). Kapalıysa null. */
async function baglam() {
  const ab = await requireAbility()
  if (!(await TakipRepository.acikMi())) return null
  const r = await MentorRepository.listMentorships(ab.userId, ab.schoolId)
  if (r.error) throw new Error(r.error.message)
  const ogrenciler = (r.data ?? []).map(m => ({
    id: m.student_id, full_name: m.students?.full_name ?? '—', class_id: m.students?.class_id ?? null, class_name: m.students?.classes?.name ?? null,
  }))
  return { ab, ogrenciler }
}

export const DenemeService = {
  /** Stoys satırları → önizleme. Yalnız mentörün dosyanın sınıfındaki öğrencileri eşleşir; diğer satırlar sayı olarak kalır. */
  async onizle(rows: string[][]): Promise<{ error: string } | Onizleme> {
    const b = await baglam()
    if (!b) return { error: KAPALI }
    const p = parseStoys(rows)
    if ('error' in p) return p
    const sinifId = await R.sinifBul(b.ab.schoolId, p.sinif)
    if (!sinifId) return { error: `Dosyadaki sınıf (${p.sinif}) okulda bulunamadı.` }
    const eslesme = eslestir(p.satirlar, b.ogrenciler, p.sinif)
    if (eslesme.eslesen.length + eslesme.katilmayan.length === 0) return { error: `${p.sinif} sınıfında mentörlüğünüzde öğrenci yok.` }
    const son = await R.sonSinav(b.ab.schoolId, p.tur, p.seviye, addDaysISO(todayLocalISO(), -14))
    return {
      tur: p.tur, seviye: p.seviye, sinif: p.sinif, sinifId, eslesme,
      ogrenciAdlari: Object.fromEntries(b.ogrenciler.map(o => [o.id, o.full_name])),
      oneri: son ? { sinavId: son.id, tarih: son.tarih } : null,
    }
  },

  /** Kaydet: sınavı bul/oluştur, sınıfı "yüklendi" işaretle, sonuçları yaz; sınıftaki öğrencilerinden listede olmayanın
   *  o sınavdaki eski satırı silinir (tekrar yükleme = güncelleme). Mentörün o sınıftaki öğrencisi olmayan biri varsa istek reddedilir. */
  async kaydet(girdi: unknown): Promise<{ error?: string; kaydedilen?: number }> {
    const p = denemeKaydetSema.safeParse(girdi)
    if (!p.success) return { error: p.error.issues[0]?.message ?? 'Geçersiz veri' }
    const b = await baglam()
    if (!b) return { error: KAPALI }
    const g = p.data, okul = b.ab.schoolId
    const sinifOgr = b.ogrenciler.filter(o => o.class_id === g.sinifId).map(o => o.id)
    const izinli = new Set(sinifOgr)
    const ids = g.sonuclar.map(s => s.studentId)
    if (ids.some(id => !izinli.has(id))) return { error: 'Listede mentörlüğünüzde olmayan ya da bu sınıfta olmayan öğrenci var.' }
    if (new Set(ids).size !== ids.length) return { error: 'Aynı öğrenci iki kez eşleştirilmiş.' }

    let sinavId: string
    if (g.sinavId) {
      const s = await R.sinav(okul, g.sinavId)
      if (!s || s.tur !== g.tur || s.seviye !== g.seviye) return { error: 'Seçilen sınav bulunamadı.' }
      sinavId = s.id
    } else {
      sinavId = await R.sinavAlVeyaOlustur({ school_id: okul, tur: g.tur, seviye: g.seviye, tarih: g.tarih, created_by: b.ab.userId })
    }
    await R.sinifYuklendi(sinavId, g.sinifId, okul)
    await R.sonuclariYaz(g.sonuclar.map(s => ({
      sinav_id: sinavId, student_id: s.studentId, school_id: okul, dersler: s.dersler, toplam_net: s.toplamNet, puan: s.puan, updated_by: b.ab.userId,
    })))
    const yazilan = new Set(ids)
    await R.sonuclariSil(sinavId, sinifOgr.filter(id => !yazilan.has(id)))
    return { kaydedilen: ids.length }
  },

  /** Yanlış yüklemeyi geri al: mentörün o sınıftaki öğrencilerinin o sınavdaki sonuçları (sınav ve sınıf kaydı kalır). */
  async sil(sinavId: string, sinifId: string): Promise<{ error?: string }> {
    const b = await baglam()
    if (!b) return { error: KAPALI }
    await R.sonuclariSil(sinavId, b.ogrenciler.filter(o => o.class_id === sinifId).map(o => o.id))
    return {}
  },

  /** Mentörün öğrencilerinin sonucu olan sınavlar, sınav×sınıf başına satır, yeniden eskiye. */
  async liste(): Promise<DenemeListeSatiri[]> {
    const b = await baglam()
    if (!b) return []
    const ogr = new Map(b.ogrenciler.map(o => [o.id, o]))
    const satirlar = await R.ogrenciSonuclari([...ogr.keys()])
    const gruplar = new Map<string, DenemeListeSatiri>()
    for (const s of satirlar) {
      const o = ogr.get(s.student_id)
      if (!o?.class_id) continue
      const k = `${s.sinav_id}|${o.class_id}`
      const g = gruplar.get(k) ?? { sinavId: s.sinav_id, tur: s.deneme_sinavlari.tur as DenemeTuru, tarih: s.deneme_sinavlari.tarih,
        sinif: o.class_name ?? '—', sinifId: o.class_id, ogrenciSayisi: 0, ogrenciler: [] }
      g.ogrenciSayisi++
      g.ogrenciler.push({ id: o.id, ad: o.full_name, dersler: s.dersler as unknown as DersSonucu[], toplamNet: Number(s.toplam_net) })
      gruplar.set(k, g)
    }
    for (const g of gruplar.values()) g.ogrenciler.sort((a, b) => a.ad.localeCompare(b.ad, 'tr'))
    return [...gruplar.values()].sort((a, b) => b.tarih.localeCompare(a.tarih) || a.tur.localeCompare(b.tur))
  },
}
