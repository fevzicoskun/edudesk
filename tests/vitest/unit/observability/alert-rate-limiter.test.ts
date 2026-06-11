/**
 * Kritik hata bildirimi rate limiter testleri.
 *
 * - Aynı parmak izi pencere içinde ikinci kez gönderilmez
 * - 1 saat (pencere) sonra aynı parmak izi tekrar gönderilebilir
 * - Global limit: pencere içinde toplam en fazla 5 e-posta
 * - Farklı hatalar ayrı parmak izleri üretir ve ayrı sayılır
 */
import { describe, it, expect } from 'vitest'
import { AlertRateLimiter, errorFingerprint } from '@/src/infrastructure/observability/alert-rate-limiter'

const HOUR = 60 * 60 * 1000

/** Enjekte edilebilir sahte saat */
function fakeClock(start = 0) {
  let t = start
  return {
    now: () => t,
    advance: (ms: number) => { t += ms },
  }
}

describe('errorFingerprint', () => {
  it('aynı name+message için deterministik aynı parmak izini üretir', () => {
    expect(errorFingerprint('TypeError', 'x is not a function'))
      .toBe(errorFingerprint('TypeError', 'x is not a function'))
  })

  it('farklı hatalar için farklı parmak izi üretir', () => {
    expect(errorFingerprint('TypeError', 'x is not a function'))
      .not.toBe(errorFingerprint('RangeError', 'invalid array length'))
  })

  it('mesajın sadece ilk 200 karakterini dikkate alır', () => {
    const base = 'a'.repeat(300)
    const fp1 = errorFingerprint('Error', base + 'SUFFIX-1')
    const fp2 = errorFingerprint('Error', base + 'SUFFIX-2')
    expect(fp1).toBe(fp2) // 200. karakterden sonraki fark parmak izini değiştirmez
  })
})

describe('AlertRateLimiter', () => {
  it('aynı parmak izi pencere içinde ikinci kez gönderilmez', () => {
    const clock = fakeClock()
    const limiter = new AlertRateLimiter({ now: clock.now })

    expect(limiter.tryAcquire('fp-1')).toBe(true)
    expect(limiter.tryAcquire('fp-1')).toBe(false)

    clock.advance(30 * 60 * 1000) // 30 dk sonra hâlâ pencere içinde
    expect(limiter.tryAcquire('fp-1')).toBe(false)
  })

  it('1 saat geçtikten sonra aynı parmak izi tekrar gönderilebilir', () => {
    const clock = fakeClock()
    const limiter = new AlertRateLimiter({ now: clock.now })

    expect(limiter.tryAcquire('fp-1')).toBe(true)
    clock.advance(HOUR) // tam 1 saat → pencere doldu
    expect(limiter.tryAcquire('fp-1')).toBe(true)
  })

  it('global limit: saatte toplam en fazla 5 e-posta', () => {
    const clock = fakeClock()
    const limiter = new AlertRateLimiter({ now: clock.now })

    for (let i = 1; i <= 5; i++) {
      expect(limiter.tryAcquire(`fp-${i}`)).toBe(true)
    }
    // 6. farklı hata bile global limite takılır
    expect(limiter.tryAcquire('fp-6')).toBe(false)
  })

  it('global limit kayan penceredir: 1 saat sonra tekrar gönderilebilir', () => {
    const clock = fakeClock()
    const limiter = new AlertRateLimiter({ now: clock.now })

    for (let i = 1; i <= 5; i++) limiter.tryAcquire(`fp-${i}`)
    expect(limiter.tryAcquire('fp-6')).toBe(false)

    clock.advance(HOUR) // ilk 5 gönderim pencere dışına düştü
    expect(limiter.tryAcquire('fp-6')).toBe(true)
  })

  it('farklı hatalar ayrı sayılır (limit dolmadıkça birbirini engellemez)', () => {
    const clock = fakeClock()
    const limiter = new AlertRateLimiter({ now: clock.now })

    expect(limiter.tryAcquire('fp-a')).toBe(true)
    expect(limiter.tryAcquire('fp-b')).toBe(true)
    expect(limiter.tryAcquire('fp-a')).toBe(false) // a tekrarı engellenir
    expect(limiter.tryAcquire('fp-c')).toBe(true)  // c bağımsız çalışır
  })

  it('özel pencere ve global limit değerleri enjekte edilebilir', () => {
    const clock = fakeClock()
    const limiter = new AlertRateLimiter({ windowMs: 1000, maxGlobalPerWindow: 2, now: clock.now })

    expect(limiter.tryAcquire('fp-1')).toBe(true)
    expect(limiter.tryAcquire('fp-2')).toBe(true)
    expect(limiter.tryAcquire('fp-3')).toBe(false) // global limit 2

    clock.advance(1000)
    expect(limiter.tryAcquire('fp-1')).toBe(true) // pencere doldu
  })
})
