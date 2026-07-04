import { describe, it, expect } from 'vitest'
import { previousSchoolDayGap, formatGunlukOzet } from '@/src/domains/notifications/gunlukOzetMath'

const bos = {
  dersSatiri: '',
  nobetSatirlari: [] as string[],
  eksikYoklamaSiniflari: [] as string[],
  bugunTeslimOdevler: [] as string[],
  randevular: [] as { period: number; studentName: string }[],
}

describe('previousSchoolDayGap', () => {
  it('Pazartesi 3 gün geri (Cuma), diğer günler 1 gün', () => {
    expect(previousSchoolDayGap(1)).toBe(3)
    expect(previousSchoolDayGap(2)).toBe(1)
    expect(previousSchoolDayGap(5)).toBe(1)
  })
})

describe('formatGunlukOzet', () => {
  it('tüm bölümler boş → null (bildirim gitmez)', () => {
    expect(formatGunlukOzet(bos)).toBeNull()
  })

  it('başlık kuralı: ders > nöbet > genel', () => {
    expect(formatGunlukOzet({ ...bos, dersSatiri: '1. ders 9-A' })?.title).toBe('Bugünün dersleri')
    expect(formatGunlukOzet({ ...bos, nobetSatirlari: ['Bugün nöbettesin: 12:00 · Bahçe'] })?.title).toBe('Bugün nöbettesin')
    expect(formatGunlukOzet({ ...bos, bugunTeslimOdevler: ['Kesirler'] })?.title).toBe('Günlük özet')
  })

  it('tam gövde: satır sırası ders → nöbet → yoklama → ödev → randevu', () => {
    const r = formatGunlukOzet({
      dersSatiri: '1. ders 9-A',
      nobetSatirlari: ['Bugün nöbettesin: 12:00 · Bahçe'],
      eksikYoklamaSiniflari: ['9-A'],
      bugunTeslimOdevler: ['Kesirler'],
      randevular: [{ period: 3, studentName: 'Ayşe Yılmaz' }],
    })
    expect(r?.body.split('\n')).toEqual([
      '1. ders 9-A',
      '🔔 Bugün nöbettesin: 12:00 · Bahçe',
      '⚠️ Dün 9-A yoklaması alınmadı',
      '📚 Bugün teslim: "Kesirler"',
      '👤 Veli görüşmesi: 3. ders Ayşe Yılmaz',
    ])
  })

  it('eksik yoklama çoğul formatı', () => {
    const r = formatGunlukOzet({ ...bos, eksikYoklamaSiniflari: ['9-A', '10-B'] })
    expect(r?.body).toBe('⚠️ Dün 2 sınıfın yoklaması alınmadı: 9-A, 10-B')
  })

  it('ödev kısaltması: 2+ ödevde ilk başlık + sayaç', () => {
    const r = formatGunlukOzet({ ...bos, bugunTeslimOdevler: ['Kesirler', 'Üslü Sayılar', 'Denklemler'] })
    expect(r?.body).toBe('📚 Bugün teslim: "Kesirler" (+2 ödev)')
  })

  it('randevular period sırasına dizilir, her biri ayrı satır', () => {
    const r = formatGunlukOzet({
      ...bos,
      randevular: [
        { period: 5, studentName: 'Ali Kaya' },
        { period: 2, studentName: 'Ayşe Yılmaz' },
      ],
    })
    expect(r?.body.split('\n')).toEqual([
      '👤 Veli görüşmesi: 2. ders Ayşe Yılmaz',
      '👤 Veli görüşmesi: 5. ders Ali Kaya',
    ])
  })
})
