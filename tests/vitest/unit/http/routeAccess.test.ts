import { describe, it, expect } from 'vitest'
import { isPublicPath } from '@/src/infrastructure/http/routeAccess'

describe('isPublicPath', () => {
  it("public route'lara (auth gerektirmeyen) izin verir", () => {
    expect(isPublicPath('/')).toBe(true)
    expect(isPublicPath('/login')).toBe(true)
    expect(isPublicPath('/offline')).toBe(true)
    expect(isPublicPath('/auth/callback')).toBe(true)
  })

  it("kendi auth'unu yapan public API endpoint'lerine izin verir", () => {
    expect(isPublicPath('/api/health')).toBe(true)
    expect(isPublicPath('/api/ready')).toBe(true)
    expect(isPublicPath('/api/live')).toBe(true)
    expect(isPublicPath('/api/unsubscribe')).toBe(true)
    expect(isPublicPath('/api/veli/event')).toBe(true)
    expect(isPublicPath('/api/inngest')).toBe(true)
  })

  it("public prefix'in alt path'lerine izin verir", () => {
    expect(isPublicPath('/veli/abc123token')).toBe(true)
    expect(isPublicPath('/auth/callback/google')).toBe(true)
  })

  it("korumalı route'ları reddeder", () => {
    expect(isPublicPath('/anasayfa')).toBe(false)
    expect(isPublicPath('/platform')).toBe(false)
    expect(isPublicPath('/odevler')).toBe(false)
    expect(isPublicPath('/api/export')).toBe(false)
    expect(isPublicPath('/api/push/subscribe')).toBe(false)
    expect(isPublicPath('/api/rapor/devamsizlik')).toBe(false)
  })

  it("prefix tuzağına düşmez (/loginxyz public değil)", () => {
    expect(isPublicPath('/loginediyorum')).toBe(false)
    expect(isPublicPath('/veliler')).toBe(false)
  })
})
