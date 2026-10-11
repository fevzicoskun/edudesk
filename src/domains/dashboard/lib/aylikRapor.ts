// Kurucuya aylık okul raporu — saf hesap. Rakamlar Ödev Takibi ile aynı formülden (odevTakibi) gelir;
// ödevler teslim gününe (yoksa veriliş) göre aya ayrılır.
import { odevTakibi, GECIKME_GUNU, type TakipOdev, type TakipTeslim } from '@/src/domains/homework/lib/odev-takibi'
import { oran } from '@/src/domains/homework/lib/analitik'

/** Ayın ilk 7 günü geçen ay raporlanır (1 Kasım → Ekim), sonrası içinde bulunulan ay. 'YYYY-MM' */
export function raporAyi(bugun: string): string {
  const [y, m, d] = bugun.split('-').map(Number)
  if (d > 7) return bugun.slice(0, 7)
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`
}

export function oncekiAy(ay: string): string {
  return raporAyi(`${ay}-01`)
}

export function sonrakiAy(ay: string): string {
  const [y, m] = ay.split('-').map(Number)
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`
}

export type AylikSatir = { ad: string; bu: number | null; gecen: number | null; yuzde?: boolean }

export type AylikRapor = {
  ay: string
  gecenAy: string
  ozet: AylikSatir[]
  /** en çok düşen önce; iki ayda da ödevi olmayan sınıf yok */
  siniflar: { ad: string; bu: number | null; gecen: number | null }[]
  iyi: string[]
  dikkat: string[]
}

type Girdi = {
  homeworks: TakipOdev[]
  submissions: TakipTeslim[]
  students: { id: string; full_name: string; class_id: string }[]
  ogretmenler: Map<string, string>
  siniflar: Map<string, string>
  bugun: string
  ay: string
  bulten: { bu: number; gecen: number }
}

const referans = (h: TakipOdev) => h.due_date ?? h.assigned_date
const ESIK = 5 // puan; altındaki oynamalar "değişim" sayılmaz

function ayOlcu(g: Girdi, ay: string) {
  const odevler = g.homeworks.filter(h => referans(h).startsWith(ay))
  const ids = new Set(odevler.map(h => h.id))
  let yapildi = 0, isaretli = 0, mazeretli = 0
  for (const s of g.submissions) {
    if (!ids.has(s.homework_id)) continue
    isaretli++
    if (s.status === 'yapildi') yapildi++
    else if (s.status === 'mazeretli') mazeretli++
  }
  const t = odevTakibi({ ...g, homeworks: odevler, ders: null })
  const edildi = t.dersler.reduce((s, d) => s + d.kontrolEdildi, 0)
  const vakti = edildi + t.dersler.reduce((s, d) => s + d.kontrolEdilecek, 0)
  return {
    odev: odevler.length,
    tamamlanma: oran(yapildi, isaretli, mazeretli),
    kontrol: vakti > 0 ? Math.round((edildi / vakti) * 100) : null,
    ogretmen: new Set(odevler.map(h => h.teacher_id)).size,
    siniflar: t.siniflar,
  }
}

const fark = (bu: number | null, gecen: number | null) => (bu === null || gecen === null ? null : bu - gecen)

export function aylikRapor(g: Girdi): AylikRapor {
  const gecenAy = oncekiAy(g.ay)
  const b = ayOlcu(g, g.ay)
  const o = ayOlcu(g, gecenAy)
  const simdi = odevTakibi({ ...g, ders: null }) // Ödev Takibi ekranının bugünkü hâli

  const ozet: AylikSatir[] = [
    { ad: 'Verilen ödev', bu: b.odev, gecen: o.odev },
    { ad: 'Ödev tamamlanma', bu: b.tamamlanma, gecen: o.tamamlanma, yuzde: true },
    { ad: 'Öğretmen kontrol oranı', bu: b.kontrol, gecen: o.kontrol, yuzde: true },
    { ad: 'Ödev veren öğretmen', bu: b.ogretmen, gecen: o.ogretmen },
    // Karşılaştırmasız: risk eşiği (dersde ≥3 kontrol) veri biriktikçe dolar — geçen ayla kıyas
    // "kötüleşme" gibi okunur (canlıda Eylül 30 → Ekim 78, çoğu veri birikimi; 2026-10-11)
    { ad: 'Riskli öğrenci (bugün)', bu: simdi.riskliOgrenciler.length, gecen: null },
    { ad: 'Gönderilen veli bülteni', bu: g.bulten.bu, gecen: g.bulten.gecen },
  ]

  const gecenSinif = new Map(o.siniflar.map(c => [c.ad, c.tamamlanma]))
  const siniflar = [...new Set([...b.siniflar.map(c => c.ad), ...gecenSinif.keys()])]
    .map(ad => ({ ad, bu: b.siniflar.find(c => c.ad === ad)?.tamamlanma ?? null, gecen: gecenSinif.get(ad) ?? null }))
    .sort((x, y) => (fark(x.bu, x.gecen) ?? 999) - (fark(y.bu, y.gecen) ?? 999) || x.ad.localeCompare(y.ad, 'tr'))

  const iyi: string[] = [], dikkat: string[] = []
  const t = fark(b.tamamlanma, o.tamamlanma)
  if (t !== null && t >= ESIK) iyi.push(`Okul geneli ödev tamamlanma %${o.tamamlanma} → %${b.tamamlanma}`)
  if (t !== null && t <= -ESIK) dikkat.push(`Okul geneli ödev tamamlanma %${o.tamamlanma} → %${b.tamamlanma}`)

  const degisen = siniflar.filter(c => fark(c.bu, c.gecen) !== null)
  const enCokDusen = degisen[0]
  const enCokArtan = degisen[degisen.length - 1]
  if (enCokArtan && fark(enCokArtan.bu, enCokArtan.gecen)! >= ESIK) iyi.push(`${enCokArtan.ad} tamamlanma %${enCokArtan.gecen} → %${enCokArtan.bu}`)
  if (enCokDusen && fark(enCokDusen.bu, enCokDusen.gecen)! <= -ESIK) dikkat.push(`${enCokDusen.ad} tamamlanma %${enCokDusen.gecen} → %${enCokDusen.bu}`)

  // Bekleyen kontrol bugünün durumu (ay ayrımı yok): kurucunun soracağı "şu an ne birikti"
  const geciken = simdi.gecikenler
  if (geciken.length) dikkat.push(`${geciken.length} ödev ${GECIKME_GUNU} günden uzun süredir kontrol bekliyor (en eskisi ${geciken[0].gun} gün)`)

  return { ay: g.ay, gecenAy, ozet, siniflar, iyi, dikkat }
}
