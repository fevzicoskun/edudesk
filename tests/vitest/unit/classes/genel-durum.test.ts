import { describe, it, expect } from 'vitest'
import { genelDurum, odevSeviyesi, MIN_DEGERLENDIRILEN } from '@/src/domains/classes/lib/genelDurum'

const d = (degerlendirilen: number, oran: number, devamsizlik: 'yok' | 'uyari' | 'sinir' = 'yok') =>
  genelDurum({ degerlendirilen, oran, devamsizlikUyari: devamsizlik === 'uyari', devamsizlikSinir: devamsizlik === 'sinir' })

describe('genelDurum() — öğrenci sayfası rozeti', () => {
  it('eşik 5 kontrol edilmiş ödev', () => {
    expect(MIN_DEGERLENDIRILEN).toBe(5)
  })

  it('az ödevle (5\'ten az) ödev oranından hüküm verilmez — %0 bile olsa', () => {
    expect(d(0, 0)).toBe('az')
    expect(d(1, 0)).toBe('az')
    expect(d(4, 25)).toBe('az')
    expect(d(4, 100)).toBe('az')
  })

  it('yeterli ödevde eski eşikler: <%40 Risk, <%60 Dikkat, gerisi İyi', () => {
    expect(d(5, 39)).toBe('risk')
    expect(d(5, 40)).toBe('dikkat')
    expect(d(5, 59)).toBe('dikkat')
    expect(d(5, 60)).toBe('iyi')
    expect(d(20, 100)).toBe('iyi')
  })

  it('devamsızlık sınırı ödev sayısından bağımsız Risk', () => {
    expect(d(0, 0, 'sinir')).toBe('risk')
    expect(d(10, 100, 'sinir')).toBe('risk')
  })

  it('devamsızlık uyarısı az ödevde de Dikkat; yeterli ödevde Risk\'i ezmez', () => {
    expect(d(2, 0, 'uyari')).toBe('dikkat')
    expect(d(10, 100, 'uyari')).toBe('dikkat')
    expect(d(10, 10, 'uyari')).toBe('risk')
  })
})

describe('odevSeviyesi() — çubuk rengi rozetle aynı eşikte', () => {
  it('rozetle birebir: az / <%40 risk / <%60 dikkat / iyi', () => {
    expect(odevSeviyesi(4, 0)).toBe('az')
    expect(odevSeviyesi(5, 39)).toBe('risk')
    expect(odevSeviyesi(5, 40)).toBe('dikkat')
    expect(odevSeviyesi(5, 60)).toBe('iyi')
  })

  it('devamsızlık yoksa genelDurum = odevSeviyesi (iki gösterge ayrışamaz)', () => {
    for (const deg of [0, 4, 5, 12]) for (const oran of [0, 39, 40, 59, 60, 100]) {
      expect(genelDurum({ degerlendirilen: deg, oran, devamsizlikUyari: false, devamsizlikSinir: false })).toBe(odevSeviyesi(deg, oran))
    }
  })
})
