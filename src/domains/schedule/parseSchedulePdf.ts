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

// Gun etiketi -> 1..5. Iki harfli kisaltma (aSc) ve tam gun adi birlikte desteklenir.
// Tam kelime eslesmesi sart: "Saat" basligi "Sa" (Sali) sanilmamali.
const DAY_NO: Record<string, number> = {
  pa: 1, sa: 2, 'ça': 3, pe: 4, cu: 5,
  pzt: 1, sal: 2, 'çar': 3, per: 4, cum: 5,
  pazartesi: 1, 'salı': 2, 'çarşamba': 3, 'perşembe': 4, cuma: 5,
}
const dayNo = (raw: string): number | undefined =>
  DAY_NO[raw.trim().toLocaleLowerCase('tr')]

// Sutun basligi: "1", "6.", "1. ders", "3. saat" -> ders saati numarasi.
// Saat araliklari (":" icerir) ve serbest metin eslesmez.
const PERIOD_RE = /^(\d{1,2})\s*\.?\s*(?:ders|saat)?\.?$/i
const periodNo = (raw: string): number | undefined => {
  const m = PERIOD_RE.exec(raw.trim())
  if (!m) return undefined
  const n = +m[1]
  return n >= 1 && n <= 12 ? n : undefined
}

// Sinif adi ADAYI: rakamla baslayan kisa etiket (11TM-A, 12SAY-A, 9B, 10/A).
// Yalnizca "eslesmeyenleri raporlamak" icin kullanilir; gercek karar okulun
// sinif listesiyle yapilan normalize eslesmesidir.
const CLASS_LIKE = /^\d{1,2}[A-Za-zÇĞİÖŞÜçğıöşü0-9\-/ ]{0,10}$/

const cx = (it: PdfTextItem) => it.x + it.width / 2

/** Okul sinifi; pdf_alias, PDF'te farkli yazilan sube adidir (orn. 11-A icin "11TM-A"). */
export interface ClassRef { id: string; name: string; pdf_alias?: string | null }

/** Bos sonucun nedeni — kullaniciya hangi adimin dustugunu soylemek icin. */
export type ParseFailure = 'bos-sayfa' | 'period-yok' | 'gun-yok' | 'sinif-eslesmedi'

export interface ParseResult {
  slots: Slot[]
  /** Hic slot uretilemediyse nedeni, uretildiyse null */
  reason: ParseFailure | null
  /** PDF'te sinif gibi gorunup okulun sinif listesiyle eslesmeyen adlar */
  unmatched: string[]
}

// Ders programi PDF'inin metin katmanini koordinatlardan slot'lara cevirir.
// Birlestirilmis hucre (2 saatlik ders) sinif adinin merkez-x'i iki sutun SINIRINA,
// tek hucre sutun MERKEZINE duser — fark koordinattan kesin olculur (tahmin yok).
export function parseSchedulePdf(items: PdfTextItem[], classes: ClassRef[]): ParseResult {
  if (items.length === 0) return { slots: [], reason: 'bos-sayfa', unmatched: [] }

  // 1) Ders saati sutunlari: no -> merkez-x
  const periodCx: { no: number; x: number }[] = []
  for (const it of items) {
    const no = periodNo(it.str)
    if (no !== undefined) periodCx.push({ no, x: cx(it) })
  }
  periodCx.sort((a, b) => a.x - b.x)
  if (periodCx.length === 0) return { slots: [], reason: 'period-yok', unmatched: [] }

  // normal sutun genisligi = ardisik period merkezleri farkinin en kucugu (ogle bosluğu buyuktur)
  let minGap = Infinity
  for (let i = 1; i < periodCx.length; i++) minGap = Math.min(minGap, periodCx[i].x - periodCx[i - 1].x)

  // 2) Gun satirlari: label merkez-y
  const dayY: { day: number; y: number }[] = []
  for (const it of items) {
    const d = dayNo(it.str)
    if (d) dayY.push({ day: d, y: it.y })
  }
  if (dayY.length === 0) return { slots: [], reason: 'gun-yok', unmatched: [] }

  const nearestDay = (y: number) =>
    dayY.reduce((best, d) => (Math.abs(d.y - y) < Math.abs(best.y - y) ? d : best)).day

  // tek hucre -> [merkez period]; birlesik -> kapsadigi iki period
  const periodsFor = (x: number): number[] => {
    const byDist = [...periodCx].sort((a, b) => Math.abs(a.x - x) - Math.abs(b.x - x))
    const nearest = byDist[0]
    if (byDist.length < 2) return [nearest.no]
    const [p, q] = [byDist[0], byDist[1]].sort((a, b) => a.x - b.x)
    const mid = (p.x + q.x) / 2
    const merged = Math.abs(q.x - p.x) <= minGap * 1.5 && Math.abs(x - mid) < Math.abs(x - nearest.x)
    return merged ? [p.no, q.no] : [nearest.no]
  }

  // 3) Sinif adlari -> gun + period(ler) -> okul class_id (normalize eslesme)
  // Hem resmi ad hem PDF takma adi eslesme anahtari olur ("11-A" ve "11TM-A" ayni sinif)
  const byNorm = new Map<string, string>()
  for (const c of classes) {
    byNorm.set(normalizeClassName(c.name), c.id)
    if (c.pdf_alias) byNorm.set(normalizeClassName(c.pdf_alias), c.id)
  }
  const seen = new Set<string>()
  const unmatched = new Set<string>()
  const out: Slot[] = []
  for (const it of items) {
    const name = it.str.trim()
    const id = byNorm.get(normalizeClassName(name))
    if (!id) {
      // Sinif gibi duran ama okulun listesinde olmayan adi rapor et (ornegin sube adi farkli yazilmis)
      if (CLASS_LIKE.test(name)) unmatched.add(name)
      continue
    }
    const day = nearestDay(it.y)
    for (const period of periodsFor(cx(it))) {
      const k = `${day}-${period}`
      if (seen.has(k)) continue
      seen.add(k)
      out.push({ day, period, class_id: id })
    }
  }

  const reason: ParseFailure | null =
    out.length > 0 ? null : unmatched.size > 0 ? 'sinif-eslesmedi' : 'bos-sayfa'
  return { slots: out, reason, unmatched: [...unmatched] }
}
