import { describe, it, expect } from 'vitest'
import { gunlukOdevMetni } from '@/src/domains/homework/lib/gunlukOdevMetni'

const hw = (sinif: string, ders: string, baslik: string, sonTeslim: string | null = null) =>
  ({ sinif, ders, baslik, sonTeslim })

describe('gunlukOdevMetni() — gün sonu iletilecek ödev listesi', () => {
  it('boş → boş metin', () => {
    expect(gunlukOdevMetni([])).toBe('')
  })

  it('sınıfa göre gruplar, sınıflar doğal sırada (9-A, 10-A)', () => {
    const t = gunlukOdevMetni([
      hw('10-A', 'Matematik', 'Kaynak s.5', '2026-09-26'),
      hw('9-A', 'Matematik', 'Test 3'),
      hw('10-A', 'Geometri', 'Üçgenler'),
    ])
    expect(t).toBe(
      '9-A\n• Matematik: Test 3\n\n' +
      '10-A\n• Matematik: Kaynak s.5 (son teslim 26.09)\n• Geometri: Üçgenler'
    )
  })
})
