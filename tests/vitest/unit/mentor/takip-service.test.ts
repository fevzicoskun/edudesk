import { describe, it, expect, vi, beforeEach } from 'vitest'
import { yeniHafta } from '@/src/domains/mentor/takip/takipMath'

vi.mock('@/src/shared/authorization/server', () => ({ requireAbility: vi.fn().mockResolvedValue({ userId: 'u1', schoolId: 's1' }) }))
vi.mock('@/src/infrastructure/observability/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }))
vi.mock('@/src/domains/mentor/repositories/TakipRepository', () => ({
  TakipRepository: { acikMi: vi.fn(), mentoruMu: vi.fn(), haftaEkle: vi.fn(), haftaGuncelle: vi.fn() },
}))
const { TakipRepository: R } = await import('@/src/domains/mentor/repositories/TakipRepository')
const { TakipService } = await import('@/src/domains/mentor/services/TakipService')

const SID = '11111111-1111-4111-8111-111111111111'
const girdi = (sonBilinen: string | null = null) => {
  const h = yeniHafta(null, 9)
  h.icerik.gorevler[1] = { ...h.icerik.gorevler[1], yapti: true, soru: 40, dogru: 30 }
  return { studentId: SID, hafta: '2026-10-19', seviye: h.seviye, soruHedefi: h.soruHedefi, icerik: h.icerik, gorusme: h.gorusme, sonBilinen }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(R.acikMi).mockResolvedValue(true)
  vi.mocked(R.mentoruMu).mockResolvedValue(true)
  vi.mocked(R.haftaEkle).mockResolvedValue({ updatedAt: 't1' })
  vi.mocked(R.haftaGuncelle).mockResolvedValue({ updatedAt: 't2' })
})

describe('TakipService.kaydet', () => {
  it('bayrak kapalı → reddedilir, yazılmaz', async () => {
    vi.mocked(R.acikMi).mockResolvedValue(false)
    expect((await TakipService.kaydet(girdi())).error).toBeTruthy()
    expect(R.haftaEkle).not.toHaveBeenCalled()
  })
  it('mentörü değil → reddedilir', async () => {
    vi.mocked(R.mentoruMu).mockResolvedValue(false)
    expect((await TakipService.kaydet(girdi())).error).toBeTruthy()
  })
  it('ilk kayıt: özet sunucuda hesaplanır', async () => {
    const r = await TakipService.kaydet(girdi())
    expect(r).toEqual({ updatedAt: 't1' })
    expect(vi.mocked(R.haftaEkle).mock.calls[0][0]).toMatchObject({ soru: 40, dogru: 30, gorev_yapilan: 1, islendi: true, school_id: 's1', updated_by: 'u1' })
  })
  it('ilk kayıtta satır zaten varsa (başka sekme) → çakışma', async () => {
    vi.mocked(R.haftaEkle).mockResolvedValue({ cakisma: true })
    expect(await TakipService.kaydet(girdi())).toEqual({ cakisma: true })
  })
  it('güncelleme updated_at uyuşmazsa → çakışma', async () => {
    vi.mocked(R.haftaGuncelle).mockResolvedValue({ cakisma: true })
    expect(await TakipService.kaydet(girdi('2026-10-16T10:00:00.000Z'))).toEqual({ cakisma: true })
    expect(vi.mocked(R.haftaGuncelle).mock.calls[0][1]).toBe('2026-10-16T10:00:00.000Z')
  })
  it('geçersiz girdi (doğru>soru) → hata, yazılmaz', async () => {
    const g = girdi(); g.icerik.gorevler[1].dogru = 99
    expect((await TakipService.kaydet(g)).error).toMatch(/Doğru/)
    expect(R.haftaEkle).not.toHaveBeenCalled()
  })
})
