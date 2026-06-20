import { describe, it, expect } from 'vitest'
import { isMeaningfulText } from '@/src/shared/validation/text'

describe('isMeaningfulText', () => {
  it('klavye-mash (aynı karakter 3+ ardışık) reddedilir', () => {
    expect(isMeaningfulText('kkkkkkk')).toBe(false)
    expect(isMeaningfulText('aaaa')).toBe(false)
    expect(isMeaningfulText('ooooo')).toBe(false)
    expect(isMeaningfulText('test kkk yazı')).toBe(false) // ortada da yakalanır
  })

  it('meşru başlıkları kabul eder (false-positive yok)', () => {
    expect(isMeaningfulText('Ünite 3 Tekrar')).toBe(true)
    expect(isMeaningfulText('TBT')).toBe(true)
    expect(isMeaningfulText('9-A ödevi')).toBe(true)
    expect(isMeaningfulText('Sayfa 42-45')).toBe(true)
    expect(isMeaningfulText('Kesirler')).toBe(true)
  })

  it('aynı karakterin 2 ardışık tekrarı meşrudur (Türkçe kelimeler)', () => {
    expect(isMeaningfulText('dikkat')).toBe(true) // çift k
    expect(isMeaningfulText('hassas')).toBe(true) // çift s
    expect(isMeaningfulText('mücadele')).toBe(true)
  })

  it('boş/whitespace reddedilir', () => {
    expect(isMeaningfulText('')).toBe(false)
    expect(isMeaningfulText('   ')).toBe(false)
  })

  it('büyük/küçük harf mash de yakalanır (case-insensitive)', () => {
    expect(isMeaningfulText('KKKKK')).toBe(false)
    expect(isMeaningfulText('AaAaA')).toBe(false) // lowercase aaaaa → mash, çöp sayılır
  })
})
