import { describe, it, expect } from 'vitest'
import { normalizeClassName, parseSchedulePdf, extractPageTitle, findTeacherPageIndex, type PdfTextItem } from '@/src/domains/schedule/parseSchedulePdf'

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
    const { slots } = parseSchedulePdf(REAL_ITEMS, CLASSES)
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
    const { slots } = parseSchedulePdf(CELLS.filter(c => ['M', 'S-MAT', 'mntör'].includes(c.str)), CLASSES)
    expect(slots).toEqual([])
  })
})

describe('normalizeClassName', () => {
  it('ayraç ve büyük/küçük harf farkını yok sayar', () => {
    expect(normalizeClassName('9B')).toBe(normalizeClassName('9/B'))
    expect(normalizeClassName('10 A')).toBe(normalizeClassName('10-a'))
  })
})

describe('extractPageTitle', () => {
  it('en üstteki satırı (öğretmen adı) döndürür', () => {
    const items: PdfTextItem[] = [
      { str: 'DENİZLİ - ÖZEL DENİZLİ BAHÇEŞEHİR KOLEJİ', x: 17.0, y: 526.0, width: 294.0 },
      { str: 'FEVZİ COŞKUN', x: 293.9, y: 539.1, width: 254.5 },
      { str: '1', x: 129.8, y: 507.5, width: 8.8 },
    ]
    expect(extractPageTitle(items)).toBe('FEVZİ COŞKUN')
  })
  it('aynı satırdaki parçaları soldan sağa birleştirir', () => {
    const items: PdfTextItem[] = [
      { str: 'FEVZİ', x: 293.9, y: 539.1, width: 80 },
      { str: 'COŞKUN', x: 400.0, y: 539.1, width: 100 },
    ]
    expect(extractPageTitle(items)).toBe('FEVZİ COŞKUN')
  })
})

describe('findTeacherPageIndex', () => {
  const titles = ['YASEMİN ÖZDANIŞMAN', 'KUDRET CAN', 'HÜSEYİN ÜNAL', 'FEVZİ COŞKUN']
  it('Türkçe büyük/küçük harf farkını yok sayarak eşleştirir', () => {
    expect(findTeacherPageIndex(titles, 'Fevzi Coşkun')).toBe(3)
    expect(findTeacherPageIndex(titles, 'yasemin özdanışman')).toBe(0)
  })
  it('eşleşme yoksa -1 döner', () => {
    expect(findTeacherPageIndex(titles, 'Olmayan Öğretmen')).toBe(-1)
  })
  it('göbek adı farkını tolere eder (içerme)', () => {
    expect(findTeacherPageIndex(['FEVZİ MEHMET COŞKUN'], 'Fevzi Coşkun')).toBe(0)
  })
})

describe('parseSchedulePdf — kenar durumları', () => {
  it('boş girdide boş döner', () => {
    expect(parseSchedulePdf([], CLASSES).slots).toEqual([])
  })
  it('okul sınıfıyla eşleşmeyen dersi düşürür', () => {
    const items = [...HEADERS, ...DAYS, { str: '12Z', x: 120.4, y: 164.3, width: 27.6 }]
    expect(parseSchedulePdf(items, CLASSES).slots).toEqual([])
  })
})


// -----------------------------------------------------------
// Ikinci bicim: gun adlari tam yazili, sutun basliklari "1. ders",
// sube adlari alan kodlu (11TM-A). Gercek PDF'ten alinmis koordinatlar.
const NF_HEADERS: PdfTextItem[] = [
  { str: 'Saat', x: 60, y: 505.3, width: 21.7 },
  { str: '1. ders', x: 130, y: 510.5, width: 33.2 },
  { str: '9:00-9:35', x: 129.1, y: 500, width: 35 },
  { str: '2. ders', x: 207.8, y: 510.5, width: 33.2 },
  { str: '9:45-10:20', x: 204.6, y: 500, width: 39.6 },
  { str: '3. ders', x: 285.6, y: 510.5, width: 33.2 },
  { str: '4. ders', x: 363.4, y: 510.5, width: 33.2 },
  { str: '5. ders', x: 441.2, y: 510.5, width: 33.2 },
  { str: '6. ders', x: 519, y: 510.5, width: 33.2 },
  { str: '7. ders', x: 596.8, y: 510.5, width: 33.2 },
  { str: '8. ders', x: 674.6, y: 510.5, width: 33.2 },
  { str: '9. ders', x: 752.4, y: 510.5, width: 33.2 },
]
const NF_DAYS: PdfTextItem[] = [
  { str: 'Pazartesi', x: 48.5, y: 458.5, width: 44.6 },
  { str: 'Salı',      x: 62,   y: 401.8, width: 17.7 },
  { str: 'Çarşamba',  x: 47,   y: 345.1, width: 47.6 },
  { str: 'Perşembe',  x: 47,   y: 288.4, width: 47.7 },
  { str: 'Cuma',      x: 57.4, y: 231.7, width: 26.9 },
]
const NF_CELLS: PdfTextItem[] = [
  { str: '11TM-A',  x: 323,   y: 463,   width: 36.2 },  // Pzt 3-4 (birlesik)
  { str: '12TM-A',  x: 439.7, y: 463,   width: 36.2 },  // Pzt 5
  { str: '12TM-A',  x: 634.2, y: 463,   width: 36.2 },  // Pzt 7-8
  { str: '10A',     x: 759.8, y: 463,   width: 18.4 },  // Pzt 9
  { str: '12TM-A',  x: 167.4, y: 406.3, width: 36.2 },  // Sal 1-2
  { str: '12SAY-A', x: 359.6, y: 406.3, width: 40.8 },  // Sal 4
  { str: '12SAY-A', x: 165.1, y: 349.6, width: 40.8 },  // Car 1-2
  { str: '11TM-A',  x: 712,   y: 349.6, width: 36.2 },  // Car 8-9
  { str: '11TM-A',  x: 128.5, y: 292.9, width: 36.2 },  // Per 1
  { str: '12TM-A',  x: 206.3, y: 292.9, width: 36.2 },  // Per 2
  { str: '11TM-A',  x: 361.9, y: 292.9, width: 36.2 },  // Per 4
  { str: '9A',      x: 490.4, y: 292.9, width: 12.5 },  // Per 5-6
  { str: '11TM-A',  x: 478.6, y: 236.2, width: 36.2 },  // Cum 5-6
  { str: '10A',     x: 604.2, y: 236.2, width: 18.4 },  // Cum 7
  { str: '12TM-A',  x: 673.1, y: 236.2, width: 36.2 },  // Cum 8
]
// Ders adlari ve dipnot - hicbiri sinif sayilmamali
const NF_NOISE: PdfTextItem[] = [
  { str: 'Matematik',   x: 321.2, y: 453.5, width: 39.9 },
  { str: 'Matematik 1', x: 628.8, y: 453.5, width: 47 },
  { str: 'Geometri',    x: 440.3, y: 453.5, width: 35 },
  { str: 'S-MAT',       x: 134.8, y: 283.4, width: 23.6 },
  { str: 'Öğle yemeği: 13:00-13:30 · Sınıf bazında toplam: 11TM-A 8 saat, 12TM-A 7 saat.', x: 40, y: 192.6, width: 677.7 },
]
const NF_ITEMS = [...NF_HEADERS, ...NF_DAYS, ...NF_CELLS, ...NF_NOISE]

// Okulun siniflari PDF'teki alan kodlu adlarla ayni yazildiginda
const NF_CLASSES = [
  { id: 'c-11tma',  name: '11TM-A' },
  { id: 'c-12tma',  name: '12TM-A' },
  { id: 'c-12saya', name: '12SAY-A' },
  { id: 'c-10a',    name: '10-A' },
  { id: 'c-9a',     name: '9-A' },
]

describe('parseSchedulePdf - tam gun adi + "N. ders" bicimi', () => {
  it('22 ders saatini dogru gun/saate yerlestirir', () => {
    const { slots, reason } = parseSchedulePdf(NF_ITEMS, NF_CLASSES)
    expect(reason).toBeNull()
    expect(slots).toHaveLength(22)
    expect(new Set(slots.map(key))).toEqual(new Set([
      '1-3:c-11tma', '1-4:c-11tma', '1-5:c-12tma', '1-7:c-12tma', '1-8:c-12tma', '1-9:c-10a',
      '2-1:c-12tma', '2-2:c-12tma', '2-4:c-12saya',
      '3-1:c-12saya', '3-2:c-12saya', '3-8:c-11tma', '3-9:c-11tma',
      '4-1:c-11tma', '4-2:c-12tma', '4-4:c-11tma', '4-5:c-9a', '4-6:c-9a',
      '5-5:c-11tma', '5-6:c-11tma', '5-7:c-10a', '5-8:c-12tma',
    ]))
  })

  it('sinif basina toplam saat PDF dipnotuyla ayni', () => {
    const { slots } = parseSchedulePdf(NF_ITEMS, NF_CLASSES)
    const perClass = slots.reduce<Record<string, number>>((acc, s) => {
      acc[s.class_id] = (acc[s.class_id] ?? 0) + 1
      return acc
    }, {})
    expect(perClass).toEqual({ 'c-11tma': 8, 'c-12tma': 7, 'c-12saya': 3, 'c-10a': 2, 'c-9a': 2 })
  })

  it('"Saat" basligini Sali sanmaz', () => {
    const { slots } = parseSchedulePdf(NF_ITEMS, NF_CLASSES)
    expect(slots.every(s => s.day >= 1 && s.day <= 5)).toBe(true)
    expect(slots.filter(s => s.day === 2)).toHaveLength(3)
  })

  it('ders adlarini ve dipnotu sinif saymaz', () => {
    const { slots } = parseSchedulePdf([...NF_HEADERS, ...NF_DAYS, ...NF_NOISE], NF_CLASSES)
    expect(slots).toEqual([])
  })
})

describe('parseSchedulePdf - bos sonucun nedenini bildirir', () => {
  it('gun satiri taninmazsa reason "gun-yok"', () => {
    const { slots, reason } = parseSchedulePdf([...NF_HEADERS, ...NF_CELLS], NF_CLASSES)
    expect(slots).toEqual([])
    expect(reason).toBe('gun-yok')
  })

  it('ders saati sutunu taninmazsa reason "period-yok"', () => {
    const { slots, reason } = parseSchedulePdf([...NF_DAYS, ...NF_CELLS], NF_CLASSES)
    expect(slots).toEqual([])
    expect(reason).toBe('period-yok')
  })

  it('sinif adlari okulunkilerle eslesmezse reason "sinif-eslesmedi" + eslesmeyenler', () => {
    const okulSiniflari = [{ id: 'x', name: '11-A' }, { id: 'y', name: '12-A' }]
    const { slots, reason, unmatched } = parseSchedulePdf(NF_ITEMS, okulSiniflari)
    expect(slots).toEqual([])
    expect(reason).toBe('sinif-eslesmedi')
    expect(new Set(unmatched)).toEqual(new Set(['11TM-A', '12TM-A', '12SAY-A', '10A', '9A']))
  })

  it('kismi eslesmede reason null, eslesmeyenler yine raporlanir', () => {
    const kismi = [{ id: 'c-10a', name: '10-A' }, { id: 'c-9a', name: '9-A' }]
    const { slots, reason, unmatched } = parseSchedulePdf(NF_ITEMS, kismi)
    expect(reason).toBeNull()
    expect(slots).toHaveLength(4)
    expect(new Set(unmatched)).toEqual(new Set(['11TM-A', '12TM-A', '12SAY-A']))
  })
})

describe('parseSchedulePdf — pdf_alias ile şube eşleme', () => {
  it('sınıf adı farklı yazılsa da takma adla eşleşir', () => {
    // Okulda sade ad kullanılıyor; PDF alan kodlu yazıyor → alias köprü kurar
    const aliasli = [
      { id: 'x11a', name: '11-A', pdf_alias: '11TM-A' },
      { id: 'x12a', name: '12-A', pdf_alias: '12TM-A' },
      { id: 'x12b', name: '12-B', pdf_alias: '12SAY-A' },
      { id: 'x10a', name: '10-A' },
      { id: 'x9a',  name: '9-A'  },
    ]
    const { slots, reason, unmatched } = parseSchedulePdf(NF_ITEMS, aliasli)
    expect(reason).toBeNull()
    expect(unmatched).toEqual([])
    expect(slots).toHaveLength(22)
    const perClass = slots.reduce<Record<string, number>>((a, s) => { a[s.class_id] = (a[s.class_id] ?? 0) + 1; return a }, {})
    expect(perClass).toEqual({ x11a: 8, x12a: 7, x12b: 3, x10a: 2, x9a: 2 })
  })

  it('takma ad yoksa davranış değişmez (resmi ad ile eşleşme)', () => {
    const { slots } = parseSchedulePdf(NF_ITEMS, [{ id: 'x10a', name: '10-A', pdf_alias: null }])
    expect(slots).toHaveLength(2)
  })
})
