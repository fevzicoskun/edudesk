import type { OgretmenSatiri } from '@/src/domains/homework/lib/odev-takibi'
import { aktifMi } from './aktiflik'

/** MY/müdür ana sayfasının saf hesapları (spec 2026-10-10 yönetici ana sayfası). */

export type OgretmenTakipSatiri = {
  id: string
  ad: string
  brans: string | null
  odev: number
  kontrolOrani: number | null
  enEskiBekleyen: number | null
  sonGun: string | null
  aktif: boolean
}

/** Öğretmen listesi + Ödev Takibi'nin öğretmen satırları + son kullanım → tek tablo, sorunlular üstte. */
export function ogretmenTakibi(p: {
  ogretmenler: { id: string; full_name: string | null; subject: string | null }[]
  odevSatirlari: Omit<OgretmenSatiri, 'kontrolEdildi'>[]
  kullanim: Map<string, { sonGun: string }>
  bugun: string
}): OgretmenTakipSatiri[] {
  // ponytail: odevTakibi öğretmeni adla gruplar; aynı adlı iki öğretmen birleşir — olursa odevTakibi'ne id eklenir
  const odev = new Map(p.odevSatirlari.map(o => [o.ad, o]))
  const sorun = (r: OgretmenTakipSatiri) => (r.enEskiBekleyen != null ? 0 : !r.aktif ? 1 : r.odev === 0 ? 2 : 3)
  return p.ogretmenler
    .map(t => {
      const ad = t.full_name ?? '—'
      const o = odev.get(ad)
      const sonGun = p.kullanim.get(t.id)?.sonGun ?? null
      return {
        id: t.id, ad, brans: t.subject,
        odev: o?.odev ?? 0, kontrolOrani: o?.kontrolOrani ?? null, enEskiBekleyen: o?.enEskiBekleyen ?? null,
        sonGun, aktif: aktifMi(sonGun, p.bugun),
      }
    })
    .sort((a, b) => sorun(a) - sorun(b) || (b.enEskiBekleyen ?? 0) - (a.enEskiBekleyen ?? 0) || a.ad.localeCompare(b.ad, 'tr'))
}

export type BultenIlerleme = { mentorId: string; ad: string; gonderilen: number; toplam: number }

/** Bu hafta mentör başına bülten: güncel mentörlük öğrencilerinden kaçı "gönderildi" işaretli. */
export function bultenIlerlemesi(p: {
  mentorluklar: { student_id: string; mentor_id: string }[]
  gonderilenler: string[]
  mentorAdlari: Map<string, string>
}): BultenIlerleme[] {
  const gonderilen = new Set(p.gonderilenler)
  const m = new Map<string, BultenIlerleme>()
  for (const r of p.mentorluklar) {
    const s = m.get(r.mentor_id) ?? { mentorId: r.mentor_id, ad: p.mentorAdlari.get(r.mentor_id) ?? 'Öğretmen', gonderilen: 0, toplam: 0 }
    s.toplam++
    if (gonderilen.has(r.student_id)) s.gonderilen++
    m.set(r.mentor_id, s)
  }
  return [...m.values()].sort((a, b) => a.gonderilen / a.toplam - b.gonderilen / b.toplam || a.ad.localeCompare(b.ad, 'tr'))
}

/** Mentörü atanmamış öğrencisi olan sınıflar. */
export function mentorsuzSiniflar(p: {
  ogrenciler: { id: string; class_id: string }[]
  mentorlu: Set<string>
  siniflar: Map<string, string>
}): { id: string; ad: string; mentorsuz: number; toplam: number }[] {
  const m = new Map<string, { mentorsuz: number; toplam: number }>()
  for (const o of p.ogrenciler) {
    const s = m.get(o.class_id) ?? { mentorsuz: 0, toplam: 0 }
    s.toplam++
    if (!p.mentorlu.has(o.id)) s.mentorsuz++
    m.set(o.class_id, s)
  }
  return [...m]
    .filter(([, s]) => s.mentorsuz > 0)
    .map(([id, s]) => ({ id, ad: p.siniflar.get(id) ?? '—', ...s }))
    .sort((a, b) => a.ad.localeCompare(b.ad, 'tr', { numeric: true }))
}
