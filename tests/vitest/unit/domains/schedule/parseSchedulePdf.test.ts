import { describe, it, expect } from 'vitest'
import { normalizeClassName, parseSchedulePdf, type PdfTextItem } from '@/src/domains/schedule/parseSchedulePdf'

// FEVZİ COŞKUN sayfasından GERÇEK pdfjs koordinatları (transform[4]=x, transform[5]=y, width).
// pdfjs y ekseni alt-köken (büyük y = üst). Period başlıkları en üstte (y≈507), günler solda.
const HEADERS: PdfTextItem[] = [
  { str: '1', x: 129.8, y: 507.5, width: 8.8 },
  { str: '2', x: 202.6, y: 507.5, width: 8.8 },
  { str: '3', x: 275.3, y: 507.5, width: 8.8 },
  { str: '4', x: 348.1, y: 507.5, width: 8.8 },
  { str: '5', x: 420.8, y: 507.5, width: 8.8 },
  { str: '6.', x: 491.4, y: 507.5, width: 13.2 },
  { str: 'ÖĞLE YEMEĞİ', x: 538.0, y: 513.1, width: 65.5 },
  { str: '7.', x: 636.9, y: 507.5, width: 13.2 },
  { str: '8.', x: 709.6, y: 507.5, width: 13.2 },
  { str: '9.', x: 782.4, y: 507.5, width: 13.2 },
]
const DAYS: PdfTextItem[] = [
  { str: 'Pa', x: 46.8, y: 426.5, width: 21.2 },
  { str: 'Sa', x: 46.8, y: 339.7, width: 21.2 },
  { str: 'Ça', x: 46.3, y: 252.9, width: 22.2 },
  { str: 'Pe', x: 46.8, y: 166.1, width: 21.2 },
  { str: 'Cu', x: 46.3, y: 79.4, width: 22.2 },
]
// Ders blokları + etiketler (M/S-MAT/mntör — bunlar sınıf değil, elenmelidir)
const CELLS: PdfTextItem[] = [
  { str: 'M', x: 610.7, y: 463.6, width: 7.2 },
  { str: '9B', x: 629.6, y: 424.7, width: 27.6 },   // Pa p7
  { str: 'M', x: 392.5, y: 376.8, width: 7.2 },
  { str: '10B', x: 405.1, y: 337.9, width: 40.1 },  // Sa p5
  { str: '9A', x: 666.0, y: 337.9, width: 27.6 },   // Sa p7-8
  { str: '10A', x: 296.0, y: 251.1, width: 40.1 },  // Ça p3-4
  { str: '9B', x: 447.8, y: 251.1, width: 27.6 },   // Ça p5-6
  { str: '9A', x: 629.6, y: 251.1, width: 27.6 },   // Ça p7
  { str: '10A', x: 441.5, y: 164.3, width: 40.1 },  // Pe p5-6
  { str: 'S-MAT', x: 101.5, y: 203.2, width: 26.4 },
  { str: '9B', x: 120.4, y: 164.3, width: 27.6 },   // Pe p1
  { str: '9A', x: 302.3, y: 164.3, width: 27.6 },   // Pe p3-4
  { str: '10B', x: 659.7, y: 164.3, width: 40.1 },  // Pe p7-8
  { str: 'mntör', x: 756.2, y: 203.2, width: 22.2 },
  { str: '10A', x: 768.9, y: 164.3, width: 40.1 },  // Pe p9
  { str: '10B', x: 441.5, y: 77.5, width: 40.1 },   // Cu p5-6
  { str: '9B', x: 156.8, y: 77.5, width: 27.6 },    // Cu p1-2
  { str: '10A', x: 259.6, y: 77.5, width: 40.1 },   // Cu p3
]
const REAL_ITEMS = [...HEADERS, ...DAYS, ...CELLS]

const CLASSES = [
  { id: 'id-9a', name: '9/A' },
  { id: 'id-9b', name: '9/B' },
  { id: 'id-10a', name: '10/A' },
  { id: 'id-10b', name: '10/B' },
  { id: 'id-9c', name: '9-C' },   // PDF'te yok → hiç slot üretmemeli
  { id: 'id-11a', name: '11/A' }, // PDF'te yok
]

const key = (s: { day: number; period: number; class_id: string }) => `${s.day}-${s.period}:${s.class_id}`

describe('parseSchedulePdf — gerçek FEVZİ COŞKUN sayfası', () => {
  it('birleştirilmiş hücreleri kapsadıkları her saate yayar (22 ders saati)', () => {
    const slots = parseSchedulePdf(REAL_ITEMS, CLASSES)
    const got = new Set(slots.map(key))
    const expected = [
      '1-7:id-9b',
      '2-5:id-10b', '2-7:id-9a', '2-8:id-9a',
      '3-3:id-10a', '3-4:id-10a', '3-5:id-9b', '3-6:id-9b', '3-7:id-9a',
      '4-1:id-9b', '4-3:id-9a', '4-4:id-9a', '4-5:id-10a', '4-6:id-10a', '4-7:id-10b', '4-8:id-10b', '4-9:id-10a',
      '5-1:id-9b', '5-2:id-9b', '5-3:id-10a', '5-5:id-10b', '5-6:id-10b',
    ]
    expect(slots).toHaveLength(22)
    expect(got).toEqual(new Set(expected))
  })

  it('M / S-MAT / mntör etiketlerini sınıf saymaz', () => {
    const slots = parseSchedulePdf(CELLS.filter(c => ['M', 'S-MAT', 'mntör'].includes(c.str)), CLASSES)
    expect(slots).toEqual([])
  })
})

describe('normalizeClassName', () => {
  it('ayraç ve büyük/küçük harf farkını yok sayar', () => {
    expect(normalizeClassName('9B')).toBe(normalizeClassName('9/B'))
    expect(normalizeClassName('10 A')).toBe(normalizeClassName('10-a'))
  })
})

describe('parseSchedulePdf — kenar durumları', () => {
  it('boş girdide boş döner', () => {
    expect(parseSchedulePdf([], CLASSES)).toEqual([])
  })
  it('okul sınıfıyla eşleşmeyen dersi düşürür', () => {
    const items = [...HEADERS, ...DAYS, { str: '12Z', x: 120.4, y: 164.3, width: 27.6 }]
    expect(parseSchedulePdf(items, CLASSES)).toEqual([])
  })
})
