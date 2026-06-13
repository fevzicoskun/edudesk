import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const ORIG_ENV = { ...process.env }

beforeEach(() => {
  vi.resetModules()
  process.env = { ...ORIG_ENV }
})

afterEach(() => {
  process.env = { ...ORIG_ENV }
})

describe('getWhatsAppHref()', () => {
  it('env var ayarlandığında doğru wa.me URL üretir', async () => {
    process.env.NEXT_PUBLIC_WHATSAPP_NUMBER = '905551234567'
    const { getWhatsAppHref } = await import('@/app/components/landing/whatsapp')
    const href = getWhatsAppHref()
    expect(href).toBe(
      'https://wa.me/905551234567?text=EduDesk%20hakk%C4%B1nda%20bilgi%20almak%20istiyorum'
    )
  })

  it('env var yokken fallback numarasıyla URL üretir', async () => {
    delete process.env.NEXT_PUBLIC_WHATSAPP_NUMBER
    const { getWhatsAppHref } = await import('@/app/components/landing/whatsapp')
    const href = getWhatsAppHref()
    expect(href).toContain('wa.me/')
    expect(href).toContain('EduDesk')
  })
})
