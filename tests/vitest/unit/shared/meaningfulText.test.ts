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

// 2026-09-28: kural rakam/noktalama/Romen rakamını da "mash" sayıyordu — "Ünite III", "sayfa 1000"
// reddediliyordu (e2e başlığındaki zaman damgası "111" içerdiğinde de → kararsız test).
describe('isMeaningfulText — meşru tekrarlar (yanlış alarm yok)', () => {
  it('rakam tekrarı meşrudur', () => {
    expect(isMeaningfulText('sayfa 1000')).toBe(true)
    expect(isMeaningfulText('Test 111')).toBe(true)
    expect(isMeaningfulText('2000 soru')).toBe(true)
    expect(isMeaningfulText('E2EGECMIS1790625111222')).toBe(true)
  })

  it('noktalama tekrarı meşrudur', () => {
    expect(isMeaningfulText('Tekrar...')).toBe(true)
    expect(isMeaningfulText('Önemli!!!')).toBe(true)
    expect(isMeaningfulText('s. 12---18')).toBe(true)
  })

  it('Romen rakamı meşrudur (büyük/küçük, noktalı)', () => {
    expect(isMeaningfulText('Ünite III')).toBe(true)
    expect(isMeaningfulText('III. Bölüm')).toBe(true)
    expect(isMeaningfulText('Bölüm XXX')).toBe(true)
    expect(isMeaningfulText('ünite iii')).toBe(true)
  })

  it('harf mash yine yakalanır — rakam/Romen muafiyeti bunu delmez', () => {
    expect(isMeaningfulText('Ünite 3 kkkk')).toBe(false)
    expect(isMeaningfulText('Sayfa 1000 aaaa')).toBe(false)
    expect(isMeaningfulText('şşşş')).toBe(false) // Türkçe harf
    expect(isMeaningfulText('İİİİ ödev')).toBe(false) // Türkçe büyük İ
  })
})
