import type { Slot } from './scheduleMath'

// Modelden beklenen ham hücre (yalnız DOLU hücreler döner).
export interface OcrCell { day: number; period: number; class: string }

// "9 / A" ≡ "9-A" ≡ "9a" — küçük harf, harf-dışı/rakam-dışı ayraçları sök.
export function normalizeClassName(name: string): string {
  return String(name ?? '').toLowerCase().replace(/[^a-z0-9çğıöşü]/gi, '')
}

const DAY_NAMES = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma']

// Görüntüden slot çıkarımı için talimat. Modelden yalnız verilen sınıf
// isimlerinden birini ya da hiç döndürmemesi istenir.
export function buildOcrPrompt(classNames: string[]): string {
  const list = classNames.map(n => `"${n}"`).join(', ')
  return [
    'Bu bir okul haftalık ders programı görüntüsü. Her dolu hücredeki sınıfı çıkar.',
    `Günler: 1=Pazartesi … 5=Cuma (${DAY_NAMES.join(', ')}). Hafta sonu yok.`,
    'period = soldaki ders sırası (1. ders = 1, 2. ders = 2, …).',
    `Sınıf adı YALNIZCA şu listeden olmalı: [${list}].`,
    'Listeyle eşleşmeyen, boş veya emin olmadığın hücreyi DÖNDÜRME (atla).',
    'Sadece dolu hücreleri döndür. Saatleri/zil çizelgesini çıkarma.',
  ].join('\n')
}

// Ham hücreleri okulun class_id'lerine eşler. Eşleşmeyen/aralık-dışı/çift
// hücreler düşürülür — asla class_id uydurulmaz.
export function parseOcrResult(cells: OcrCell[], classes: { id: string; name: string }[]): Slot[] {
  const byNorm = new Map(classes.map(c => [normalizeClassName(c.name), c.id]))
  const seen = new Set<string>()
  const out: Slot[] = []
  for (const c of Array.isArray(cells) ? cells : []) {
    if (!c || typeof c.day !== 'number' || typeof c.period !== 'number' || typeof c.class !== 'string') continue
    if (c.day < 1 || c.day > 5) continue
    if (!Number.isInteger(c.period) || c.period < 1 || c.period > 12) continue
    const id = byNorm.get(normalizeClassName(c.class))
    if (!id) continue
    const key = `${c.day}-${c.period}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ day: c.day, period: c.period, class_id: id })
  }
  return out
}
