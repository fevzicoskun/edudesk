import { describe, it, expect } from 'vitest'
import {
  buildTeacherStats,
  computeSummary,
  actionLabel,
  roleLabel,
  extractTitle,
  nameInitials,
  since30daysISO,
  akisSatirlari,
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

  it('sıralama: önce ödev sayısı, sonra giriş günü — "Panele girdi" kalabalığı öne geçirmez', () => {
    const giris = (id: string, gun: string): LogRow => ({ id, teacher_id: 't2', action: 'dashboard_view', meta: null, created_at: `${gun}T09:00:00Z` })
    const stats = buildTeacherStats([T1, T2], [LOG_ODEV, giris('g1', '2026-06-01'), giris('g2', '2026-06-01'), giris('g3', '2026-06-02'), giris('g4', '2026-06-03')])
    expect(stats.map(s => s.id)).toEqual(['t1', 't2']) // t1: 1 ödev; t2: 0 ödev ama 4 giriş
  })

  it('giriş günü: Türkiye saatine göre farklı gün sayısı (aynı gün çok giriş = 1)', () => {
    const l = (id: string, at: string): LogRow => ({ id, teacher_id: 't1', action: 'dashboard_view', meta: null, created_at: at })
    // 2026-06-01T22:30Z = İstanbul 2 Haziran 01:30 → ayrı gün
    const stats = buildTeacherStats([T1], [l('a', '2026-06-01T08:00:00Z'), l('b', '2026-06-01T12:00:00Z'), l('c', '2026-06-01T22:30:00Z')])
    expect(stats[0].girisGunu).toBe(2)
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

  it('ödev giren öğretmen sayısı (yalnız ödev ekleme; güncelleme/giriş sayılmaz)', () => {
    const giris: LogRow = { id: 'g', teacher_id: 't2', action: 'dashboard_view', meta: null, created_at: '2026-06-05T09:00:00Z' }
    const summary = computeSummary([T1, T2], [LOG_YOKLAMA, LOG_ODEV, LOG_UPDATE, giris])
    expect(summary.odevGirenCount).toBe(1) // yalnız t1
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
    expect(summary.odevGirenCount).toBe(0)
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

describe('akisSatirlari — aktivite akışı ayıklanmış', () => {
  const l = (id: string, teacher: string, action: string, at: string, title?: string): LogRow =>
    ({ id, teacher_id: teacher, action, meta: title ? { title } : null, created_at: at })

  it('"Panele girdi" akışta yer almaz', () => {
    expect(akisSatirlari([l('a', 't1', 'dashboard_view', '2026-06-01T09:00:00Z')])).toEqual([])
  })

  it('aynı gün aynı öğretmenin aynı işi tek satır + adet; en yeni zaman ve ilk başlık', () => {
    const r = akisSatirlari([
      l('a', 't1', 'odev_eklendi', '2026-06-01T12:00:00Z', 'C'),
      l('b', 't1', 'dashboard_view', '2026-06-01T11:30:00Z'),
      l('c', 't1', 'odev_eklendi', '2026-06-01T11:00:00Z', 'B'),
      l('d', 't1', 'odev_eklendi', '2026-06-01T10:00:00Z', 'A'),
    ])
    expect(r).toEqual([{ key: 'a', teacher_id: 't1', action: 'odev_eklendi', adet: 3, created_at: '2026-06-01T12:00:00Z', title: 'C' }])
  })

  it('farklı gün, farklı iş veya farklı öğretmen ayrı satır; sıra korunur (yeniden eskiye)', () => {
    const r = akisSatirlari([
      l('a', 't1', 'odev_eklendi', '2026-06-02T10:00:00Z'),
      l('b', 't2', 'odev_eklendi', '2026-06-02T09:00:00Z'),
      l('c', 't1', 'odev_guncellendi', '2026-06-02T08:00:00Z'),
      l('d', 't1', 'odev_eklendi', '2026-06-01T10:00:00Z'),
    ])
    expect(r.map(x => [x.key, x.adet])).toEqual([['a', 1], ['b', 1], ['c', 1], ['d', 1]])
  })
})
