import { describe, it, expect } from 'vitest'
import { feedbackSchema } from '@/src/shared/validation'

describe('feedbackSchema', () => {
  const valid = { category: 'oneri', message: 'Takvim harika olmuş', page_path: '/takvim' }

  it('geçerli girdiyi kabul eder', () => {
    expect(feedbackSchema.safeParse(valid).success).toBe(true)
  })

  it('bilinmeyen kategoriyi reddeder', () => {
    expect(feedbackSchema.safeParse({ ...valid, category: 'hata' }).success).toBe(false)
  })

  it('3 karakterden kısa mesajı reddeder', () => {
    expect(feedbackSchema.safeParse({ ...valid, message: 'ab' }).success).toBe(false)
  })

  it('2000 karakterden uzun mesajı reddeder', () => {
    expect(feedbackSchema.safeParse({ ...valid, message: 'a'.repeat(2001) }).success).toBe(false)
  })

  it('mesajı trim\'ler', () => {
    const r = feedbackSchema.safeParse({ ...valid, message: '  merhaba  ' })
    expect(r.success && r.data.message).toBe('merhaba')
  })

  it('page_path yoksa boş string\'e düşer', () => {
    const r = feedbackSchema.safeParse({ category: 'istek', message: 'yeni özellik' })
    expect(r.success && r.data.page_path).toBe('')
  })
})
