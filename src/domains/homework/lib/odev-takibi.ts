import type { SubmissionStatus } from '@/src/shared/types'
import { dersAnahtari, derseGore } from './stats'

/** MY/müdür "Ödev Takibi" ekranının saf hesabı — sayfa yalnız veriyi çeker, bileşenler yalnız gösterir. */

export type TakipOdev = {
  id: string
  title: string
  subject: string
  class_id: string
  teacher_id: string
  due_date: string | null
  assigned_date: string
}

/** Yalnız öğretmenin İŞARETLEDİĞİ teslimler (marked_at dolu) — otomatik açılan boş satırlar 'yapılmadı' değildir. */
export type TakipTeslim = {
  homework_id: string
  student_id: string
  /** DB tipi string — karşılaştırmalar SubmissionStatus sabitleriyle */
  status: SubmissionStatus | (string & {})
  marked_at: string
}

export type DersSatiri = {
  anahtar: string
  ad: string
  odev: number
  kontrolEdildi: number
  /** son teslimi geçmiş, hiç işaret yok */
  kontrolEdilecek: number
  /** son teslimi bugün/ileride, işaret yok — henüz kontrol edilemez */
  bekliyor: number
  girenler: { ad: string; sayi: number }[]
}

export type KontrolSatiri = {
  id: string
  title: string
  subject: string
  sinif: string
  ogretmen: string
  /** referans günden (son teslim, yoksa veriliş) bugüne kaç gün */
  gun: number
}

export type KontrolEdilenSatir = Omit<KontrolSatiri, 'gun'> & { yapildi: number; eksik: number; yapilmadi: number }

export type RiskliOgrenci = {
  sinifId: string
  id: string
  ad: string
  sinif: string
  toplam: number
  dersler: { ad: string; sayi: number }[]
}

export const RISK_ESIGI = 3 // analitik.computeRiskyStudents ile aynı eşik
export const GECIKME_GUNU = 3

function gunFarki(once: string, sonra: string): number {
  const utc = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return Date.UTC(y, m - 1, d) }
  return Math.round((utc(sonra) - utc(once)) / 86_400_000)
}

function sayiListesi(sayac: Map<string, number>): { ad: string; sayi: number }[] {
  return [...sayac].map(([ad, sayi]) => ({ ad, sayi })).sort((a, b) => b.sayi - a.sayi)
}

export function odevTakibi(p: {
  homeworks: TakipOdev[]
  submissions: TakipTeslim[]
  students: { id: string; full_name: string; class_id: string }[]
  ogretmenler: Map<string, string>
  siniflar: Map<string, string>
  /** İstanbul günü (todayLocalISO) */
  bugun: string
  /** ?ders= — dersAnahtari biçiminde; tanımsız/bozuksa tüm liste */
  ders: string | null
}) {
  const teslimler = new Map<string, TakipTeslim[]>()
  for (const s of p.submissions) {
    const l = teslimler.get(s.homework_id) ?? []
    l.push(s)
    teslimler.set(s.homework_id, l)
  }
  const referans = (h: TakipOdev) => h.due_date ?? h.assigned_date
  const durum = (h: TakipOdev): 'edildi' | 'edilecek' | 'bekliyor' =>
    teslimler.has(h.id) ? 'edildi' : referans(h) < p.bugun ? 'edilecek' : 'bekliyor'
  const ogretmen = (id: string) => p.ogretmenler.get(id) ?? '—'
  const sinif = (id: string) => p.siniflar.get(id) ?? '—'
  const temel = (h: TakipOdev) => ({ id: h.id, title: h.title, subject: h.subject, sinif: sinif(h.class_id), ogretmen: ogretmen(h.teacher_id) })

  // Ders satırları süzülmez — çipler ve sayılar her zaman okulun tamamını gösterir
  const dersMap = new Map<string, DersSatiri & { sayac: Map<string, number> }>()
  for (const h of p.homeworks) {
    const anahtar = dersAnahtari(h.subject)
    const d = dersMap.get(anahtar) ?? {
      anahtar, ad: h.subject.trim() || 'Diğer', odev: 0, kontrolEdildi: 0, kontrolEdilecek: 0, bekliyor: 0, girenler: [], sayac: new Map(),
    }
    d.odev++
    const dr = durum(h)
    if (dr === 'edildi') d.kontrolEdildi++
    else if (dr === 'edilecek') d.kontrolEdilecek++
    else d.bekliyor++
    d.sayac.set(ogretmen(h.teacher_id), (d.sayac.get(ogretmen(h.teacher_id)) ?? 0) + 1)
    dersMap.set(anahtar, d)
  }
  const dersler: DersSatiri[] = [...dersMap.values()]
    .map(({ sayac, ...d }) => ({ ...d, girenler: sayiListesi(sayac) }))
    .sort((a, b) => b.odev - a.odev || a.ad.localeCompare(b.ad, 'tr'))

  const suzulmus = derseGore(p.homeworks, p.ders)

  const kontrolEdilecek: KontrolSatiri[] = suzulmus
    .filter(h => durum(h) === 'edilecek')
    .map(h => ({ ...temel(h), gun: gunFarki(referans(h), p.bugun) }))
    .sort((a, b) => b.gun - a.gun)

  const sonIsaret = (id: string) => (teslimler.get(id) ?? []).reduce((m, s) => (s.marked_at > m ? s.marked_at : m), '')
  const kontrolEdilen: KontrolEdilenSatir[] = suzulmus
    .filter(h => durum(h) === 'edildi')
    .sort((a, b) => sonIsaret(b.id).localeCompare(sonIsaret(a.id)))
    .map(h => {
      const l = teslimler.get(h.id) ?? []
      const say = (st: SubmissionStatus) => l.filter(s => s.status === st).length
      return { ...temel(h), yapildi: say('yapildi'), eksik: say('eksik'), yapilmadi: say('yapilmadi') }
    })

  const odevById = new Map(suzulmus.map(h => [h.id, h]))
  const kacirma = new Map<string, Map<string, number>>() // öğrenci → ders adı → sayı
  for (const s of p.submissions) {
    if (s.status !== 'yapilmadi' && s.status !== 'eksik') continue
    const h = odevById.get(s.homework_id)
    if (!h) continue
    const m = kacirma.get(s.student_id) ?? new Map<string, number>()
    const ad = h.subject.trim() || 'Diğer'
    m.set(ad, (m.get(ad) ?? 0) + 1)
    kacirma.set(s.student_id, m)
  }
  const riskliOgrenciler: RiskliOgrenci[] = p.students
    .flatMap(o => {
      const m = kacirma.get(o.id)
      if (!m) return []
      const toplam = [...m.values()].reduce((a, b) => a + b, 0)
      return toplam >= RISK_ESIGI ? [{ id: o.id, ad: o.full_name, sinifId: o.class_id, sinif: sinif(o.class_id), toplam, dersler: sayiListesi(m) }] : []
    })
    .sort((a, b) => b.toplam - a.toplam || a.ad.localeCompare(b.ad, 'tr'))

  return {
    dersler,
    kontrolEdilecek,
    kontrolEdilen,
    gecikenler: kontrolEdilecek.filter(k => k.gun > GECIKME_GUNU),
    riskliOgrenciler,
  }
}
