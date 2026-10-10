import type { SubmissionStatus } from '@/src/shared/types'
import { dersAnahtari, derseGore } from './stats'
import { oran } from './analitik'

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
  /** yapıldı / (işaretli − mazeretli), %; hiç işaret yoksa null (analitik.oran tanımı) */
  tamamlanma: number | null
  /** bu derste riskli öğrenci sayısı (RISK_ORANI / RISK_EN_AZ_ODEV, ders bazlı) */
  riskli: number
}

export type SinifSatiri = { id: string; ad: string; odev: number; tamamlanma: number | null }

export type OgretmenSatiri = {
  ad: string
  odev: number
  kontrolEdildi: number
  /** kontrol edildi / (kontrol edildi + kontrol edilecek), %; kontrol zamanı gelmiş ödev yoksa null */
  kontrolOrani: number | null
  /** en eski kontrol edilecek ödevin bekleme günü; yoksa null */
  enEskiBekleyen: number | null
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
  /** yalnız riskli olduğu dersler, en yüksek oranlı önce; kacirma = yapılmadı + eksik, payda = kontrol edilen (mazeretli hariç) */
  dersler: { ad: string; kacirma: number; payda: number }[]
}

/** Mentör tablosu (mentorTablosu.ts) için mutlak eşik — analitik.computeRiskyStudents ile aynı */
export const RISK_ESIGI = 3
/** Ödev Takibi riskli öğrenci DERS BAZLI: bir derste kontrol edilen ödevlerin en az %50'si yapılmadı/eksik
 *  (2026-10-10 kullanıcı kararı — genel ortalama az ödevli dersteki kaçırmayı sulandırıyordu) */
export const RISK_ORANI = 50
/** Az veriyle yanıltmasın: o derste en az bu kadar kontrol edilmiş ödev */
export const RISK_EN_AZ_ODEV = 3
export const GECIKME_GUNU = 3
/** Ekran ve PDF'te aynı tanım */
export const RISK_ACIKLAMA = `Bir derste kontrol edilen ödevlerinin en az %${RISK_ORANI}'sini yapmamış veya eksik yapmış öğrenciler `
  + `(o derste en az ${RISK_EN_AZ_ODEV} kontrol edilmiş ödevi olan). Yalnız riskli olduğu dersler yazılır.`
/** "Matematik 3/5 (%60)" — kaçırma / kontrol edilen */
export const riskDersMetni = (d: { ad: string; kacirma: number; payda: number }) =>
  `${d.ad} ${d.kacirma}/${d.payda} (%${Math.round((d.kacirma / d.payda) * 100)})`

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
  type Sayim = { yapildi: number; isaretli: number; mazeretli: number }
  const yeniSayim = (): Sayim => ({ yapildi: 0, isaretli: 0, mazeretli: 0 })
  const ekle = (sy: Sayim, homeworkId: string) => {
    for (const t of teslimler.get(homeworkId) ?? []) {
      sy.isaretli++
      if (t.status === 'yapildi') sy.yapildi++
      else if (t.status === 'mazeretli') sy.mazeretli++
    }
  }
  const sayimOrani = (sy: Sayim) => oran(sy.yapildi, sy.isaretli, sy.mazeretli)
  const ogretmen = (id: string) => p.ogretmenler.get(id) ?? '—'
  const sinif = (id: string) => p.siniflar.get(id) ?? '—'
  const temel = (h: TakipOdev) => ({ id: h.id, title: h.title, subject: h.subject, sinif: sinif(h.class_id), ogretmen: ogretmen(h.teacher_id) })

  // Ders satırları süzülmez — çipler ve sayılar her zaman okulun tamamını gösterir
  const dersMap = new Map<string, DersSatiri & { sayac: Map<string, number>; say: Sayim }>()
  for (const h of p.homeworks) {
    const anahtar = dersAnahtari(h.subject)
    const d = dersMap.get(anahtar) ?? {
      anahtar, ad: h.subject.trim() || 'Diğer', odev: 0, kontrolEdildi: 0, kontrolEdilecek: 0, bekliyor: 0, girenler: [], tamamlanma: null, riskli: 0,
      sayac: new Map(), say: yeniSayim(),
    }
    d.odev++
    const dr = durum(h)
    if (dr === 'edildi') d.kontrolEdildi++
    else if (dr === 'edilecek') d.kontrolEdilecek++
    else d.bekliyor++
    d.sayac.set(ogretmen(h.teacher_id), (d.sayac.get(ogretmen(h.teacher_id)) ?? 0) + 1)
    ekle(d.say, h.id)
    dersMap.set(anahtar, d)
  }
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

  // Risk ders bazlı: öğrenci × ders sayımı TÜM ödevlerden (ders satırının riskli sayısı süzmeden bağımsız);
  // liste yalnız süzülmüş derslerle sınırlanır.
  const odevById = new Map(p.homeworks.map(h => [h.id, h]))
  const ogrenciDers = new Map<string, Map<string, { kacirma: number; payda: number }>>()
  for (const s of p.submissions) {
    const h = odevById.get(s.homework_id)
    if (!h || s.status === 'mazeretli') continue
    const dersler = ogrenciDers.get(s.student_id) ?? new Map<string, { kacirma: number; payda: number }>()
    const anahtar = dersAnahtari(h.subject)
    const d = dersler.get(anahtar) ?? { kacirma: 0, payda: 0 }
    d.payda++
    if (s.status === 'yapilmadi' || s.status === 'eksik') d.kacirma++
    dersler.set(anahtar, d)
    ogrenciDers.set(s.student_id, dersler)
  }
  const riskliMi = (d: { kacirma: number; payda: number }) => d.payda >= RISK_EN_AZ_ODEV && d.kacirma * 100 >= RISK_ORANI * d.payda
  const suzulmusDersler = new Set(suzulmus.map(h => dersAnahtari(h.subject)))
  const riskliOgrenciler: RiskliOgrenci[] = p.students
    .flatMap(o => {
      const riskliDersler = [...(ogrenciDers.get(o.id) ?? [])].filter(([, d]) => riskliMi(d))
      for (const [anahtar] of riskliDersler) dersMap.get(anahtar)!.riskli++
      const dersler = riskliDersler
        .filter(([anahtar]) => suzulmusDersler.has(anahtar))
        .map(([anahtar, d]) => ({ ad: dersMap.get(anahtar)!.ad, ...d }))
        .sort((a, b) => b.kacirma / b.payda - a.kacirma / a.payda || b.kacirma - a.kacirma || a.ad.localeCompare(b.ad, 'tr'))
      return dersler.length ? [{ id: o.id, ad: o.full_name, sinifId: o.class_id, sinif: sinif(o.class_id), dersler }] : []
    })
  const kacirmaToplami = (o: RiskliOgrenci) => o.dersler.reduce((t, d) => t + d.kacirma, 0)
  riskliOgrenciler.sort((a, b) => b.dersler.length - a.dersler.length || kacirmaToplami(b) - kacirmaToplami(a) || a.ad.localeCompare(b.ad, 'tr'))

  const dersler: DersSatiri[] = [...dersMap.values()]
    .map(({ sayac, say, ...d }) => ({ ...d, girenler: sayiListesi(sayac), tamamlanma: sayimOrani(say) }))
    .sort((a, b) => b.odev - a.odev || a.ad.localeCompare(b.ad, 'tr'))

  const sinifMap = new Map<string, { odev: number; say: Sayim }>()
  for (const h of suzulmus) {
    const c = sinifMap.get(h.class_id) ?? { odev: 0, say: yeniSayim() }
    c.odev++
    ekle(c.say, h.id)
    sinifMap.set(h.class_id, c)
  }
  // en düşük tamamlanma üstte (idarenin bakacağı yer); hiç kontrol edilmemiş sınıf sonda
  const siniflar: SinifSatiri[] = [...sinifMap]
    .map(([id, c]) => ({ id, ad: sinif(id), odev: c.odev, tamamlanma: sayimOrani(c.say) }))
    .sort((a, b) => (a.tamamlanma ?? 101) - (b.tamamlanma ?? 101) || a.ad.localeCompare(b.ad, 'tr'))

  const ogrMap = new Map<string, OgretmenSatiri & { edilecek: number }>()
  for (const h of suzulmus) {
    const ad = ogretmen(h.teacher_id)
    const o = ogrMap.get(ad) ?? { ad, odev: 0, kontrolEdildi: 0, kontrolOrani: null, enEskiBekleyen: null, edilecek: 0 }
    o.odev++
    const dr = durum(h)
    if (dr === 'edildi') o.kontrolEdildi++
    else if (dr === 'edilecek') {
      o.edilecek++
      const g = gunFarki(referans(h), p.bugun)
      o.enEskiBekleyen = Math.max(o.enEskiBekleyen ?? 0, g)
    }
    ogrMap.set(ad, o)
  }
  const ogretmenler: OgretmenSatiri[] = [...ogrMap.values()]
    .map(({ edilecek, ...o }) => {
      const vakti = o.kontrolEdildi + edilecek
      return { ...o, kontrolOrani: vakti > 0 ? Math.round((o.kontrolEdildi / vakti) * 100) : null }
    })
    .sort((a, b) => b.odev - a.odev || a.ad.localeCompare(b.ad, 'tr'))

  return {
    dersler,
    kontrolEdilecek,
    kontrolEdilen,
    gecikenler: kontrolEdilecek.filter(k => k.gun > GECIKME_GUNU),
    riskliOgrenciler,
    siniflar,
    ogretmenler,
  }
}
