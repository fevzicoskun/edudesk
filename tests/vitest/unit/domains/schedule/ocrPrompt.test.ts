import { describe, it, expect } from 'vitest'
import { normalizeClassName, buildOcrPrompt, parseOcrResult, type OcrCell } from '@/src/domains/schedule/ocrPrompt'

const CLASSES = [
  { id: 'id-9a', name: '9-A' },
  { id: 'id-10b', name: '10-B' },
]

describe('normalizeClassName', () => {
  it('boşluk, ayraç ve büyük/küçük harf farkını yok sayar', () => {
    expect(normalizeClassName('9 / A')).toBe(normalizeClassName('9-A'))
    expect(normalizeClassName('9a')).toBe(normalizeClassName('9-A'))
    expect(normalizeClassName('10 B')).toBe(normalizeClassName('10-b'))
  })
})

describe('buildOcrPrompt', () => {
  it('sınıf isimlerini ve gün/periyot çerçevesini içerir', () => {
    const p = buildOcrPrompt(['9-A', '10-B'])
    expect(p).toContain('9-A')
    expect(p).toContain('10-B')
    expect(p).toMatch(/1.*5|Pazartesi|day/i) // gün aralığı tarifi
  })
})

describe('parseOcrResult', () => {
  it('exact isimle class_id eşler', () => {
    const cells: OcrCell[] = [{ day: 1, period: 1, class: '9-A' }]
    expect(parseOcrResult(cells, CLASSES)).toEqual([{ day: 1, period: 1, class_id: 'id-9a' }])
  })
  it('normalize edilmiş isimle eşler', () => {
    const cells: OcrCell[] = [{ day: 2, period: 3, class: '10 / b' }]
    expect(parseOcrResult(cells, CLASSES)).toEqual([{ day: 2, period: 3, class_id: 'id-10b' }])
  })
  it('listede olmayan ismi düşürür (boş bırakır)', () => {
    const cells: OcrCell[] = [{ day: 1, period: 1, class: '11-Z' }]
    expect(parseOcrResult(cells, CLASSES)).toEqual([])
  })
  it('aynı (gün,periyot) çiftini teke indirir', () => {
    const cells: OcrCell[] = [
      { day: 1, period: 1, class: '9-A' },
      { day: 1, period: 1, class: '10-B' },
    ]
    expect(parseOcrResult(cells, CLASSES)).toEqual([{ day: 1, period: 1, class_id: 'id-9a' }])
  })
  it('aralık dışı gün/periyodu düşürür', () => {
    const cells: OcrCell[] = [
      { day: 0, period: 1, class: '9-A' },
      { day: 1, period: 99, class: '9-A' },
      { day: 6, period: 1, class: '10-B' },
    ]
    expect(parseOcrResult(cells, CLASSES)).toEqual([])
  })
  it('boş/bozuk girdide güvenli boş döner', () => {
    expect(parseOcrResult([], CLASSES)).toEqual([])
    // @ts-expect-error bozuk cell
    expect(parseOcrResult([{ day: 1 }], CLASSES)).toEqual([])
  })
})
