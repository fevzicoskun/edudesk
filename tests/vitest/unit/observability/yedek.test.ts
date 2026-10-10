import { describe, it, expect } from 'vitest'
import { YEDEKLENEN_TABLOLAR, yedekDosyaAdi, eskiYedekMi, yedekSiralama } from '@/src/domains/notifications/yedekMath'

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

  it('yeni tablolar kapsamda: bülten gönderimi, toplantılar, işaret geçmişi', () => {
    for (const t of ['bulten_gonderimleri', 'school_meetings', 'homework_submission_logs', 'veli_tokens']) {
      expect(YEDEKLENEN_TABLOLAR).toContain(t)
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

  it('son 30 günün her yedeği korunur', () => {
    expect(eskiYedekMi('2026-08-20-yedek.json', bugun)).toBe(false) // 30 gün, Perşembe
  })

  it('30 günden eski hafta içi yedeği silinir, Pazar yedeği 12 haftaya kadar kalır', () => {
    expect(eskiYedekMi('2026-08-19-yedek.json', bugun)).toBe(true)  // 31 gün, Çarşamba
    expect(eskiYedekMi('2026-08-16-yedek.json', bugun)).toBe(false) // 34 gün, Pazar
  })

  it('tam 84. gündeki Pazar yedeği korunur — kenar durumda veri silme', () => {
    const bugunPazar = new Date('2026-09-20T03:00:00Z') // Pazar
    const sinir = new Date(bugunPazar)
    sinir.setDate(sinir.getDate() - 84)
    expect(eskiYedekMi(yedekDosyaAdi(sinir), bugunPazar)).toBe(false)
  })

  it('beklenmeyen dosya adı asla silinmez', () => {
    expect(eskiYedekMi('elle-aldigim-yedek.json', bugun)).toBe(false)
    expect(eskiYedekMi('', bugun)).toBe(false)
  })
})

describe('yedekSiralama() — sayfalı okumada satır atlanmasın/tekrarlanmasın', () => {
  it('tekil id\'li tablo id ile sıralanır', () => {
    expect(yedekSiralama('homework_submissions')).toEqual(['id'])
  })

  it('bileşik anahtarlı tablolar kendi anahtar kolonlarıyla sıralanır (id kolonları yok)', () => {
    expect(yedekSiralama('teacher_classes')).toEqual(['teacher_id', 'class_id'])
    expect(yedekSiralama('user_roles')).toEqual(['user_id', 'role_id'])
    expect(yedekSiralama('role_permissions')).toEqual(['role_id', 'permission_id'])
    expect(yedekSiralama('user_permissions')).toEqual(['user_id', 'permission_id'])
    expect(yedekSiralama('ogretmen_dosyasi')).toEqual(['teacher_id', 'academic_year'])
  })
})
