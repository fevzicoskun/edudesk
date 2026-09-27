import { describe, it, expect } from 'vitest'
import { sunucuHatasiAlarmi, istemciKoptu } from '@/src/infrastructure/observability/sunucuHatasi'

const ctx = { routePath: '/app/takvim/ics', routeType: 'route' as const }

describe('sunucuHatasiAlarmi', () => {
  it('Error\'dan ad, mesaj, digest ve rota bilgisini çıkarır', () => {
    const err = Object.assign(new TypeError('patladı'), { digest: 'abc123' })
    const a = sunucuHatasiAlarmi(err, { path: '/odevler', method: 'GET' }, ctx)
    expect(a).toMatchObject({
      name: 'ServerError:TypeError', message: 'patladı', digest: 'abc123', source: 'server',
      context: { path: '/odevler', method: 'GET', routePath: '/app/takvim/ics', routeType: 'route' },
    })
  })

  it('sorgu dizesini atar — ICS ?key= gibi sırlar kayda düşmez', () => {
    const a = sunucuHatasiAlarmi(new Error('x'), { path: '/api/takvim/ics?key=GIZLI', method: 'GET' }, ctx)
    expect(a.context?.path).toBe('/api/takvim/ics')
    expect(JSON.stringify(a)).not.toContain('GIZLI')
  })

  it('Error olmayan fırlatılmış değeri de kaydeder', () => {
    const a = sunucuHatasiAlarmi('düz metin', { path: '/', method: 'POST' }, ctx)
    expect(a.name).toBe('ServerError:Unknown')
    expect(a.message).toBe('düz metin')
  })
})

describe('istemciKoptu — kullanıcı sayfadan ayrıldı, hata değil', () => {
  it('stream erken kapandı / aborted / ECONNRESET → kaydedilmez', () => {
    expect(istemciKoptu(new Error('The destination stream closed early.'))).toBe(true)
    expect(istemciKoptu(new Error('aborted'))).toBe(true)
    expect(istemciKoptu(Object.assign(new Error('socket hang up'), { code: 'ECONNRESET' }))).toBe(true)
  })
  it('gerçek hatalar kaydedilir', () => {
    expect(istemciKoptu(new TypeError("Cannot read properties of undefined (reading 'id')"))).toBe(false)
    expect(istemciKoptu(new Error('Profil bulunamadı'))).toBe(false)
    expect(istemciKoptu('düz metin')).toBe(false)
  })
})
