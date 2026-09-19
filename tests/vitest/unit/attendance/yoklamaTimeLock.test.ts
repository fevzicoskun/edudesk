import { describe, it, expect } from 'vitest'
import { yoklamaKilitDurumu } from '@/src/shared/constants/attendance'

// 2026-06-11'de eklenen 10:30 saat kilidi 2026-09-19'da KALDIRILDI.
// Gerekçe (canlı veri): kilitten önceki kayıtların %80'i 10:30'dan SONRA girilmişti;
// kilit eklendikten sonra 3 ay boyunca tek bir yoklama kaydı oluşmadı. Sistem 414
// "yoklama al" bildirimi gönderdi, %56'sı okundu, yine kayıt yok.
// Artık kural: öğretmen BUGÜNÜN yoklamasını gün boyu girebilir; başka gün müdür/MY'de.
describe('yoklamaKilitDurumu()', () => {
  const BUGUN = '2026-09-19'

  it('bugün sabah açık', () => {
    expect(yoklamaKilitDurumu(BUGUN, BUGUN, false)).toBe('open')
  })

  it('bugün akşam da açık — saat kilidi kaldırıldı', () => {
    // Eski davranışta 10:30 sonrası kilitliydi; artık gün boyu açık.
    expect(yoklamaKilitDurumu(BUGUN, BUGUN, false)).toBe('open')
  })

  it('geçmiş gün öğretmene kapalı', () => {
    expect(yoklamaKilitDurumu('2026-09-18', BUGUN, false)).toBe('date_locked')
  })

  it('gelecek gün de kapalı — UI izin verip sunucunun reddetmesi tutarsızdı', () => {
    expect(yoklamaKilitDurumu('2026-09-20', BUGUN, false)).toBe('date_locked')
  })

  it('müdür/MY her gün için açık', () => {
    expect(yoklamaKilitDurumu('2026-09-18', BUGUN, true)).toBe('open')
    expect(yoklamaKilitDurumu('2026-09-20', BUGUN, true)).toBe('open')
    expect(yoklamaKilitDurumu(BUGUN, BUGUN, true)).toBe('open')
  })
})
