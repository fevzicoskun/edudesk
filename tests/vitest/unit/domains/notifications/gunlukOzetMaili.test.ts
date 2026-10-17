import { describe, it, expect } from 'vitest'
import { gunlukOzetMaili, type GunlukMailGirdi } from '@/src/domains/notifications/gunlukOzetMath'

const bos: GunlukMailGirdi = {
  ad: 'Ayşe Öğretmen',
  baseUrl: 'https://x.test',
  dersSatiri: '',
  nobetSatirlari: [],
  eksikYoklamaSiniflari: [],
  bugunTeslim: [],
  bekleyen: [],
}

describe('gunlukOzetMaili', () => {
  it('ödev ve yoklama yoksa mail yok — yalnız ders/nöbet için her sabah mail atılmaz', () => {
    expect(gunlukOzetMaili(bos)).toBeNull()
    expect(gunlukOzetMaili({ ...bos, dersSatiri: '1. ders 9-A', nobetSatirlari: ['Bahçe nöbeti'] })).toBeNull()
  })

  it('bugün teslim: sınıf, öğrenci sayısı ve işaretleme bağlantısı; ders/nöbet de mailde', () => {
    const m = gunlukOzetMaili({
      ...bos, dersSatiri: '1. ders 9-A', nobetSatirlari: ['Bahçe nöbeti'],
      bugunTeslim: [{ id: 'h1', title: 'Türev <Test>', sinif: '9-A', ogrenci: 24 }],
    })!
    expect(m.subject).toBe('EduDesk sabah özeti: 1 ödev bugün teslim')
    expect(m.html).toContain('href="https://x.test/odevler/h1"')
    expect(m.html).toContain('Türev &lt;Test&gt;')
    expect(m.html).toContain('9-A · 24 öğrenci')
    expect(m.html).toContain('1. ders 9-A')
    expect(m.html).toContain('Bahçe nöbeti')
  })

  it('teslimi geçmiş işaretsiz ödevler ayrı bölümde, konuda sayısıyla', () => {
    const m = gunlukOzetMaili({
      ...bos,
      bugunTeslim: [{ id: 'h1', title: 'A', sinif: '9-A', ogrenci: 20 }],
      bekleyen: [{ id: 'h2', title: 'B', sinif: '10-B', dueDate: '2026-10-16' }, { id: 'h3', title: 'C', sinif: '10-B', dueDate: '2026-10-15' }],
    })!
    expect(m.subject).toBe('EduDesk sabah özeti: 1 ödev bugün teslim, 2 ödev işaretlenmedi')
    expect(m.html).toContain('İşaretlenmeyi bekleyen ödevler')
    expect(m.html).toContain('href="https://x.test/odevler/h3"')
  })

  it('yalnız eksik yoklama da mail için yeterli', () => {
    const m = gunlukOzetMaili({ ...bos, eksikYoklamaSiniflari: ['9-A'] })!
    expect(m.subject).toBe('EduDesk sabah özeti')
    expect(m.html).toContain('9-A')
  })
})
