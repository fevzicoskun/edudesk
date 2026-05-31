import { describe, it, expect } from 'vitest'
import { computeKanaat, generateKanaatText } from '@/src/domains/kanaat/lib/computeKanaat'

describe('computeKanaat()', () => {
  it('tüm kaynaklar mükemmel → skor 5', () => {
    const result = computeKanaat({ homeworkTotal: 10, homeworkDone: 10, absenceDays: 0, examAverage: 100 })
    expect(result).toBe(5)
  })

  it('tüm kaynaklar sıfır → skor 1', () => {
    const result = computeKanaat({ homeworkTotal: 10, homeworkDone: 0, absenceDays: 20, examAverage: 0 })
    expect(result).toBe(1)
  })

  it('ödev tamamlama %50, devamsızlık 0, sınav 50 → skor 4', () => {
    // odevScore = (0.5 * 4) + 1 = 3.0
    // devamsizlikScore = (20/20 * 4) + 1 = 5.0
    // sinavScore = (50/100 * 4) + 1 = 3.0
    // weighted = 3.0*0.4 + 5.0*0.3 + 3.0*0.3 = 1.2+1.5+0.9 = 3.6 → 4
    const result = computeKanaat({ homeworkTotal: 10, homeworkDone: 5, absenceDays: 0, examAverage: 50 })
    expect(result).toBe(4)
  })

  it('ödev yoksa (homeworkTotal === 0) ödev bileşeni devre dışı kalır', () => {
    // Sadece devamsızlık + sınav aktif → %50 / %50
    // devamsizlikScore = 5 (0 gün), sinavScore = 1 (0 puan)
    // weighted = 5*0.5 + 1*0.5 = 3.0 → 3
    const result = computeKanaat({ homeworkTotal: 0, homeworkDone: 0, absenceDays: 0, examAverage: 0 })
    expect(result).toBe(3)
  })

  it('sınav notu null ise sınav bileşeni devre dışı kalır', () => {
    // Sadece ödev + devamsızlık aktif → %57 / %43 (4:3 oranı)
    // odevScore = 5 (tümü yapıldı), devamsizlikScore = 5 (0 gün)
    // weighted = 5 → 5
    const result = computeKanaat({ homeworkTotal: 5, homeworkDone: 5, absenceDays: 0, examAverage: null })
    expect(result).toBe(5)
  })

  it('devamsızlık 20+ gün → devamsızlık bileşeni 1', () => {
    const result = computeKanaat({ homeworkTotal: 10, homeworkDone: 10, absenceDays: 25, examAverage: 100 })
    // odev=5, devamsizlik=1, sinav=5
    // 5*0.4 + 1*0.3 + 5*0.3 = 2+0.3+1.5 = 3.8 → 4
    expect(result).toBe(4)
  })

  it('dönen değer her zaman 1-5 arası tam sayı', () => {
    const cases: Parameters<typeof computeKanaat>[0][] = [
      { homeworkTotal: 3, homeworkDone: 1, absenceDays: 7, examAverage: 45 },
      { homeworkTotal: 0, homeworkDone: 0, absenceDays: 0, examAverage: null },
      { homeworkTotal: 20, homeworkDone: 20, absenceDays: 0, examAverage: 100 },
    ]
    for (const c of cases) {
      const result = computeKanaat(c)
      expect(result).toBeGreaterThanOrEqual(1)
      expect(result).toBeLessThanOrEqual(5)
      expect(Number.isInteger(result)).toBe(true)
    }
  })
})

describe('generateKanaatText()', () => {
  it('skor 5 → olumlu değerlendirme metni', () => {
    const text = generateKanaatText('Ali Kaya', 5, { homeworkPct: 100, absenceDays: 0, examAverage: 95 })
    expect(text).toContain('Ali Kaya')
    expect(text).toContain('%100')
    expect(text).toContain('0 gün')
    expect(text).toContain('95')
    expect(text).toContain('üstün başarı')
  })

  it('skor 1 → destek gerektiren değerlendirme', () => {
    const text = generateKanaatText('Ayşe M.', 1, { homeworkPct: 20, absenceDays: 18, examAverage: 30 })
    expect(text).toContain('destek gerektiren')
  })

  it('sınav girilmemişse metin içinde sınav bilgisi yok', () => {
    const text = generateKanaatText('Can B.', 3, { homeworkPct: 60, absenceDays: 5, examAverage: null })
    expect(text).not.toMatch(/sınav.*puan/i)
    expect(text).not.toContain('null')
  })
})
