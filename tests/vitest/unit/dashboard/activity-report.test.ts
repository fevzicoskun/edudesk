import { describe, it, expect } from 'vitest'
import {
  buildTeacherStats,
  computeSummary,
  actionLabel,
  roleLabel,
  extractTitle,
  nameInitials,
  since30daysISO,
  type TeacherRow,
  type LogRow,
} from '@/src/domains/dashboard/lib/activityReport'

// ─── Fixtures ────────────────────────────────────────────────────────────────

const T1: TeacherRow = { id: 't1', full_name: 'Ahmet Yılmaz', role: 'ogretmen' }
const T2: TeacherRow = { id: 't2', full_name: 'Ayşe Demir',   role: 'zumre_baskani' }
const T3: TeacherRow = { id: 't3', full_name: null,            role: 'ogretmen' }

const LOG_YOKLAMA: LogRow   = { id: 'l1', teacher_id: 't1', action: 'yoklama_kaydedildi', meta: null,                      created_at: '2026-06-01T10:00:00Z' }
const LOG_ODEV: LogRow      = { id: 'l2', teacher_id: 't1', action: 'odev_eklendi',        meta: { title: 'Test Ödevi' },   created_at: '2026-06-02T10:00:00Z' }
const LOG_UPDATE: LogRow    = { id: 'l3', teacher_id: 't2', action: 'odev_guncellendi',    meta: { title: 'Güncellendi' },  created_at: '2026-06-03T10:00:00Z' }
const LOG_YOKLAMA2: LogRow  = { id: 'l4', teacher_id: 't1', action: 'yoklama_kaydedildi', meta: null,                      created_at: '2026-06-04T08:00:00Z' }

// ─── buildTeacherStats ───────────────────────────────────────────────────────

describe('buildTeacherStats', () => {
  it('boş log ile sıfır sayımlı stat döner', () => {
    const stats = buildTeacherStats([T1], [])
    expect(stats).toHaveLength(1)
    expect(stats[0].totalCount).toBe(0)
    expect(stats[0].yoklamaCount).toBe(0)
    expect(stats[0].odevCount).toBe(0)
    expect(stats[0].lastActivity).toBeNull()
  })

  it('öğretmen yoksa boş dizi döner', () => {
    const stats = buildTeacherStats([], [LOG_YOKLAMA])
    expect(stats).toHaveLength(0)
  })

  it('yoklama sayısını doğru hesaplar', () => {
    const stats = buildTeacherStats([T1], [LOG_YOKLAMA, LOG_YOKLAMA2])
    expect(stats[0].yoklamaCount).toBe(2)
    expect(stats[0].odevCount).toBe(0)
    expect(stats[0].totalCount).toBe(2)
  })

  it('ödev ve güncelleme sayısını doğru hesaplar', () => {
    const stats = buildTeacherStats([T1, T2], [LOG_ODEV, LOG_UPDATE])
    const t1 = stats.find(s => s.id === 't1')!
    const t2 = stats.find(s => s.id === 't2')!
    expect(t1.odevCount).toBe(1)
    expect(t2.odevCount).toBe(1)
  })

  it('toplam aktiviteye göre azalan sıralama yapar', () => {
    const stats = buildTeacherStats([T1, T2], [LOG_YOKLAMA, LOG_ODEV, LOG_YOKLAMA2, LOG_UPDATE])
    expect(stats[0].id).toBe('t1') // 3 log
    expect(stats[1].id).toBe('t2') // 1 log
  })

  it('son aktivite tarihini doğru belirler', () => {
    const stats = buildTeacherStats([T1], [LOG_YOKLAMA, LOG_YOKLAMA2])
    expect(stats[0].lastActivity).toBe('2026-06-04T08:00:00Z')
  })

  it('full_name null ise Bilinmiyor kullanır', () => {
    const stats = buildTeacherStats([T3], [])
    expect(stats[0].fullName).toBe('Bilinmiyor')
  })

  it('başka öğretmene ait log kendi sayımını etkilemez', () => {
    const stats = buildTeacherStats([T1], [LOG_UPDATE]) // LOG_UPDATE t2'ye ait
    expect(stats[0].totalCount).toBe(0)
  })
})

// ─── computeSummary ──────────────────────────────────────────────────────────

describe('computeSummary', () => {
  it('aktif öğretmen sayısını doğru hesaplar', () => {
    const summary = computeSummary([T1, T2], [LOG_YOKLAMA, LOG_UPDATE])
    expect(summary.activeCount).toBe(2)
  })

  it('toplam aktivite sayısını döner', () => {
    const summary = computeSummary([T1, T2], [LOG_YOKLAMA, LOG_ODEV, LOG_UPDATE])
    expect(summary.totalActivity).toBe(3)
  })

  it('pasif öğretmen sayısını hesaplar (mudur hariç)', () => {
    const mudur: TeacherRow = { id: 'tm', full_name: 'Müdür Bey', role: 'mudur' }
    // T1, T2 ogretmen/zumre — T1 aktif, T2 pasif; mudur sayılmaz
    const summary = computeSummary([T1, T2, mudur], [LOG_YOKLAMA])
    expect(summary.passiveCount).toBe(1) // sadece T2
  })

  it('log yoksa hepsi pasif', () => {
    const summary = computeSummary([T1, T2], [])
    expect(summary.activeCount).toBe(0)
    expect(summary.passiveCount).toBe(2)
    expect(summary.totalActivity).toBe(0)
  })
})

// ─── Yardımcı fonksiyonlar ───────────────────────────────────────────────────

describe('actionLabel', () => {
  it('bilinen eylemleri Türkçeye çevirir', () => {
    expect(actionLabel('yoklama_kaydedildi')).toBe('Yoklama aldı')
    expect(actionLabel('odev_eklendi')).toBe('Ödev ekledi')
    expect(actionLabel('odev_guncellendi')).toBe('Ödev güncelledi')
  })

  it('bilinmeyen eylemi olduğu gibi döner', () => {
    expect(actionLabel('bilinmeyen_eylem')).toBe('bilinmeyen_eylem')
  })
})

describe('roleLabel', () => {
  it('rol adlarını Türkçeye çevirir', () => {
    expect(roleLabel('ogretmen')).toBe('Öğretmen')
    expect(roleLabel('mudur')).toBe('Müdür')
    expect(roleLabel('zumre_baskani')).toBe('Zümre Başkanı')
  })

  it('bilinmeyen rol değerini olduğu gibi döner', () => {
    expect(roleLabel('bilinmeyen')).toBe('bilinmeyen')
  })
})

describe('extractTitle', () => {
  it('meta içinden title string döner', () => {
    expect(extractTitle({ title: 'Test Ödevi' })).toBe('Test Ödevi')
  })

  it('meta null ise null döner', () => {
    expect(extractTitle(null)).toBeNull()
  })

  it('meta nesne değilse null döner', () => {
    expect(extractTitle('string-meta')).toBeNull()
    expect(extractTitle(42)).toBeNull()
  })

  it('title string değilse null döner', () => {
    expect(extractTitle({ title: 123 })).toBeNull()
    expect(extractTitle({ baskaAlan: 'değer' })).toBeNull()
  })
})

describe('nameInitials', () => {
  it('iki kelimeli isimden baş harfler alır', () => {
    expect(nameInitials('Ahmet Yılmaz')).toBe('AY')
  })

  it('tek kelimeli isimden tek harf alır', () => {
    expect(nameInitials('Ahmet')).toBe('A')
  })

  it('üç kelimeli isimden yalnızca ilk iki harfi alır', () => {
    expect(nameInitials('Ahmet Ali Yılmaz')).toBe('AA')
  })

  it('büyük harfe çevirir', () => {
    expect(nameInitials('ahmet yılmaz')).toBe('AY')
  })
})

describe('since30daysISO', () => {
  it('ISO formatında string döner', () => {
    const result = since30daysISO()
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('yaklaşık 30 gün önceyi döner', () => {
    const result = new Date(since30daysISO())
    const diffMs = Date.now() - result.getTime()
    const diffDays = diffMs / (1000 * 60 * 60 * 24)
    expect(diffDays).toBeCloseTo(30, 0)
  })
})
