import { describe, it, expect } from 'vitest'
import { YEDEKLENEN_TABLOLAR, yedekDosyaAdi, eskiYedekMi } from '@/src/domains/notifications/yedekMath'

describe('YEDEKLENEN_TABLOLAR', () => {
  it('geri getirilemez okul verisini kapsar', () => {
    for (const tablo of ['schools', 'profiles', 'classes', 'students', 'teacher_classes',
                         'homeworks', 'homework_submissions', 'attendance', 'school_payments']) {
      expect(YEDEKLENEN_TABLOLAR).toContain(tablo)
    }
  })

  it('yeniden üretilebilen/geçici tabloları KAPSAMAZ — yedek şişmesin', () => {
    for (const tablo of ['notifications', 'usage_daily', 'audit_logs', 'teacher_activity_log',
                         'app_errors', 'revoked_tokens', 'student_risk_history']) {
      expect(YEDEKLENEN_TABLOLAR).not.toContain(tablo)
    }
  })

  it('liste tekrarsızdır', () => {
    expect(new Set(YEDEKLENEN_TABLOLAR).size).toBe(YEDEKLENEN_TABLOLAR.length)
  })
})

describe('yedekDosyaAdi()', () => {
  it('tarihe göre sıralanabilir ad üretir', () => {
    expect(yedekDosyaAdi(new Date('2026-09-19T03:00:00Z'))).toBe('2026-09-19-yedek.json')
  })

  it('tek haneli ay ve gün sıfırla doldurulur', () => {
    expect(yedekDosyaAdi(new Date('2026-01-05T03:00:00Z'))).toBe('2026-01-05-yedek.json')
  })
})

describe('eskiYedekMi()', () => {
  const bugun = new Date('2026-09-19T03:00:00Z')

  it('12 haftadan eski yedek silinmeye aday', () => {
    expect(eskiYedekMi('2026-06-01-yedek.json', bugun)).toBe(true)
  })

  it('yeni yedek korunur', () => {
    expect(eskiYedekMi('2026-09-12-yedek.json', bugun)).toBe(false)
  })

  it('tam sınırdaki yedek korunur — kenar durumda veri silme', () => {
    const sinir = new Date(bugun)
    sinir.setDate(sinir.getDate() - 84)
    expect(eskiYedekMi(yedekDosyaAdi(sinir), bugun)).toBe(false)
  })

  it('beklenmeyen dosya adı asla silinmez', () => {
    expect(eskiYedekMi('elle-aldigim-yedek.json', bugun)).toBe(false)
    expect(eskiYedekMi('', bugun)).toBe(false)
  })
})
