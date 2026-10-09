// tests/vitest/unit/mentor/bulten-gorsel-route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/og', () => ({
  ImageResponse: class extends Response {
    constructor(_el: unknown, opt: { headers?: Record<string, string>; width?: number; height?: number }) {
      super('png', { headers: { 'content-type': 'image/png', ...(opt.headers ?? {}), 'x-h': String(opt.height) } })
    }
  },
}))
vi.mock('@/src/shared/authorization/server', () => ({ getAbility: vi.fn() }))
vi.mock('@/src/domains/mentor/services/BultenService', () => ({ BultenService: { getBulten: vi.fn() } }))
vi.mock('node:fs/promises', () => ({ readFile: vi.fn().mockResolvedValue(Buffer.from('font')) }))

const { getAbility } = await import('@/src/shared/authorization/server')
const { BultenService } = await import('@/src/domains/mentor/services/BultenService')
const { GET } = await import('@/app/api/bulten/gorsel/route')
const { gorselYuksekligi } = await import('@/src/domains/mentor/lib/bultenGorselleri')

const SINIF = '11111111-1111-4111-8111-111111111111'
const OGR = '22222222-2222-4222-8222-222222222222'
const YABANCI = '33333333-3333-4333-8333-333333333333'
const istek = (q: string) => GET(new Request(`http://x/api/bulten/gorsel?${q}`) as never)
const bulten = {
  hafta: '2026-10-12', okulAdi: 'Okul', mentorAdi: 'M', mentorUnvani: 'Matematik Öğretmeni M',
  siniflar: [{ class_id: SINIF, class_name: '9-A', gunler: [], ozet: [] }],
  ogrenciler: [{ student_id: OGR, full_name: 'Ali', class_id: SINIF, class_name: '9-A', eksikler: [], telefon: null, mesaj: '' }],
}

beforeEach(() => {
  vi.mocked(getAbility).mockResolvedValue({ cannot: () => false } as never)
  vi.mocked(BultenService.getBulten).mockResolvedValue(bulten as never)
})

describe('GET /api/bulten/gorsel', () => {
  it('girişsiz → 401', async () => {
    vi.mocked(getAbility).mockResolvedValue(null)
    expect((await istek(`tur=odevler&hafta=2026-10-12&sinif=${SINIF}`)).status).toBe(401)
  })
  it('ödev okuma yetkisi yok → 403', async () => {
    vi.mocked(getAbility).mockResolvedValue({ cannot: () => true } as never)
    expect((await istek(`tur=odevler&hafta=2026-10-12&sinif=${SINIF}`)).status).toBe(403)
  })
  it.each([
    'tur=odevler&hafta=2026-10-13&sinif=' + SINIF,   // pazartesi değil
    'tur=xxx&hafta=2026-10-12&sinif=' + SINIF,
    'tur=odevler&hafta=2026-10-12&sinif=abc',
    'tur=ogrenci&hafta=2026-10-12',                  // ogrenci eksik
  ])('geçersiz parametre → 400 (%s)', async q => expect((await istek(q)).status).toBe(400))
  it('mentörün olmayan öğrencisi → 403', async () => {
    expect((await istek(`tur=ogrenci&hafta=2026-10-12&ogrenci=${YABANCI}`)).status).toBe(403)
  })
  it('mentörün öğrencisi olmayan sınıf → 403', async () => {
    expect((await istek(`tur=ozet&hafta=2026-10-12&sinif=${YABANCI}`)).status).toBe(403)
  })
  it.each([`tur=odevler&hafta=2026-10-12&sinif=${SINIF}`, `tur=ozet&hafta=2026-10-12&sinif=${SINIF}`, `tur=ogrenci&hafta=2026-10-12&ogrenci=${OGR}`])
  ('geçerli → 200 png, önbelleksiz (%s)', async q => {
    const r = await istek(q)
    expect(r.status).toBe(200)
    expect(r.headers.get('content-type')).toBe('image/png')
    expect(r.headers.get('cache-control')).toBe('private, no-store')
  })
})

describe('gorselYuksekligi', () => {
  // Beklenen aralıklar 2026-10-09 gerçek next/og çiziminden ölçüldü (9-A, hafta 2026-10-12):
  // içerik kesilmemeli (alt sınır) ve altta ~120px'ten fazla boşluk kalmamalı (üst sınır).
  it('ödevler görseli gün başına ödev sayısına göre: [2,0,3,1,0] ≈ 1220px', () => {
    const h = gorselYuksekligi('odevler', { gunler: [2, 0, 3, 1, 0] })
    expect(h).toBeGreaterThanOrEqual(1220); expect(h).toBeLessThanOrEqual(1340)
  })
  it('öğrenci kartı: 7 eksik + [2,3,1] ≈ 1680px', () => {
    const h = gorselYuksekligi('ogrenci', { eksik: 7, gunler: [2, 3, 1] })
    expect(h).toBeGreaterThanOrEqual(1680); expect(h).toBeLessThanOrEqual(1800)
  })
  it('özet: 8 satır ≈ 1424px', () => {
    const h = gorselYuksekligi('ozet', { ozet: 8 })
    expect(h).toBeGreaterThanOrEqual(1424); expect(h).toBeLessThanOrEqual(1544)
  })
  it('tebrikli öğrenci, eksikli olandan kısa; boş gün de satır tutar', () => {
    expect(gorselYuksekligi('ogrenci', { eksik: 0, gunler: [2] })).toBeLessThan(gorselYuksekligi('ogrenci', { eksik: 3, gunler: [2] }))
    expect(gorselYuksekligi('odevler', { gunler: [0, 0, 0, 0, 0] })).toBeGreaterThan(gorselYuksekligi('odevler', { gunler: [0] }))
  })
})
