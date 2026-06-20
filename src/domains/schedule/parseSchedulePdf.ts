import type { Slot } from './scheduleMath'

// pdfjs getTextContent item'ından ihtiyacımız olan alanlar (x,y = transform[4],[5]).
export interface PdfTextItem { str: string; x: number; y: number; width: number }

// "9 / A" ≡ "9-A" ≡ "9a" — küçük harf, harf/rakam-dışı ayraçları sök.
export function normalizeClassName(name: string): string {
  return String(name ?? '').toLowerCase().replace(/[^a-z0-9çğıöşü]/g, '')
}

// Türkçe isim → kelime kümesi: tr-locale küçük harf, harf-dışı temizlenmiş ad/soyad parçaları.
function nameWords(s: string): string[] {
  return String(s ?? '')
    .toLocaleLowerCase('tr')
    .split(/\s+/)
    .map(w => w.replace(/[^a-zçğıöşü]/g, ''))
    .filter(Boolean)
}

// Sayfanın en üst satırındaki metin = öğretmen adı (PDF başlığı). pdfjs alt-köken: en büyük y en üsttedir.
export function extractPageTitle(items: PdfTextItem[]): string {
  if (items.length === 0) return ''
  const maxY = Math.max(...items.map(i => i.y))
  return items
    .filter(i => Math.abs(i.y - maxY) < 5)
    .sort((a, b) => a.x - b.x)
    .map(i => i.str)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Öğretmen adına karşılık gelen sayfa index'i. Tüm ad/soyad kelimeleri başlıkta geçmeli;
// kelime sayısı da eşitse "tam" sayılır (göbek adı farkı tolere edilir). Yoksa -1.
export function findTeacherPageIndex(titles: string[], fullName: string): number {
  const target = nameWords(fullName)
  if (target.length === 0) return -1
  let exact = -1, partial = -1
  titles.forEach((t, i) => {
    const w = nameWords(t)
    if (!target.every(tw => w.includes(tw))) return
    if (w.length === target.length) { if (exact === -1) exact = i }
    else if (partial === -1) partial = i
  })
  return exact !== -1 ? exact : partial
}

const DAY_NO: Record<string, number> = { Pa: 1, Sa: 2, Ça: 3, Pe: 4, Cu: 5 }
const CLASS_RE = /^\d{1,2}[A-Za-zÇĞİÖŞÜçğıöşü]$/
const cx = (it: PdfTextItem) => it.x + it.width / 2

// ASC ders programı PDF'inin metin katmanını koordinatlardan slot'lara çevirir.
// Birleştirilmiş hücre (2 saatlik ders) sınıf adının merkez-x'i iki sütun SINIRINA,
// tek hücre sütun MERKEZİNE düşer — fark koordinattan kesin ölçülür (tahmin yok).
export function parseSchedulePdf(items: PdfTextItem[], classes: { id: string; name: string }[]): Slot[] {
  // 1) Period başlıkları: saf sayı item'ları (saatler ":" içerdiği için elenir). no -> merkez-x
  const periodCx: { no: number; x: number }[] = []
  for (const it of items) {
    const t = it.str.trim().replace(/\.$/, '')
    if (/^\d{1,2}$/.test(t) && +t >= 1 && +t <= 12) periodCx.push({ no: +t, x: cx(it) })
  }
  periodCx.sort((a, b) => a.x - b.x)
  if (periodCx.length === 0) return []

  // normal sütun genişliği = ardışık period merkezleri farkının en küçüğü (öğle boşluğu büyüktür)
  let minGap = Infinity
  for (let i = 1; i < periodCx.length; i++) minGap = Math.min(minGap, periodCx[i].x - periodCx[i - 1].x)

  // 2) Gün satırları: label merkez-y
  const dayY: { day: number; y: number }[] = []
  for (const it of items) {
    const d = DAY_NO[it.str.trim()]
    if (d) dayY.push({ day: d, y: it.y })
  }
  if (dayY.length === 0) return []

  const nearestDay = (y: number) =>
    dayY.reduce((best, d) => (Math.abs(d.y - y) < Math.abs(best.y - y) ? d : best)).day

  // tek hücre -> [merkez period]; birleşik -> kapsadığı iki period
  const periodsFor = (x: number): number[] => {
    const byDist = [...periodCx].sort((a, b) => Math.abs(a.x - x) - Math.abs(b.x - x))
    const nearest = byDist[0]
    if (byDist.length < 2) return [nearest.no]
    const [p, q] = [byDist[0], byDist[1]].sort((a, b) => a.x - b.x)
    const mid = (p.x + q.x) / 2
    const merged = Math.abs(q.x - p.x) <= minGap * 1.5 && Math.abs(x - mid) < Math.abs(x - nearest.x)
    return merged ? [p.no, q.no] : [nearest.no]
  }

  // 3) Sınıf adları -> gün + period(ler) -> okul class_id (normalize eşleşme)
  const byNorm = new Map(classes.map(c => [normalizeClassName(c.name), c.id]))
  const seen = new Set<string>()
  const out: Slot[] = []
  for (const it of items) {
    const name = it.str.trim()
    if (!CLASS_RE.test(name)) continue
    const id = byNorm.get(normalizeClassName(name))
    if (!id) continue
    const day = nearestDay(it.y)
    for (const period of periodsFor(cx(it))) {
      const k = `${day}-${period}`
      if (seen.has(k)) continue
      seen.add(k)
      out.push({ day, period, class_id: id })
    }
  }
  return out
}
