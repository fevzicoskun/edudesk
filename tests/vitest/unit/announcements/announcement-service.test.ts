import { describe, it, expect, vi, beforeEach } from 'vitest'
import { makeUser, makeProfile } from '../../setup/factories'

vi.mock('@/src/shared/auth', () => ({
  getCurrentUser:    vi.fn(),
  getCurrentProfile: vi.fn(),
}))

vi.mock('@/src/domains/announcements/repositories/AnnouncementRepository', () => ({
  AnnouncementRepository: {
    getFirstUnread:  vi.fn(),
    markRead:        vi.fn(),
    create:          vi.fn(),
    listByCreator:   vi.fn(),
  },
}))

const { getCurrentUser, getCurrentProfile } =
  await import('@/src/shared/auth')
const { AnnouncementRepository } =
  await import('@/src/domains/announcements/repositories/AnnouncementRepository')
const { AnnouncementService } =
  await import('@/src/domains/announcements/services/AnnouncementService')

const SCHOOL_ID = 'school-announce-unit'
const user      = makeUser(SCHOOL_ID)

beforeEach(() => { vi.clearAllMocks() })

// ─────────────────────────────────────────────────────────────
describe('AnnouncementService.getFirstUnread()', () => {
  it('giriş yapılmamış kullanıcı → null döner, repository çağrılmaz', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null)
    vi.mocked(getCurrentProfile).mockResolvedValue(null)
    expect(await AnnouncementService.getFirstUnread()).toBeNull()
    expect(AnnouncementRepository.getFirstUnread).not.toHaveBeenCalled()
  })

  it('profil eksikse → null döner', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(user as never)
    vi.mocked(getCurrentProfile).mockResolvedValue(null)
    expect(await AnnouncementService.getFirstUnread()).toBeNull()
  })

  it('giriş yapmış kullanıcı → repository doğru argümanlarla çağrılır', async () => {
    const profile = makeProfile('ogretmen', SCHOOL_ID)
    vi.mocked(getCurrentUser).mockResolvedValue(user as never)
    vi.mocked(getCurrentProfile).mockResolvedValue(profile as never)
    vi.mocked(AnnouncementRepository.getFirstUnread).mockResolvedValue(null)

    await AnnouncementService.getFirstUnread()

    expect(AnnouncementRepository.getFirstUnread).toHaveBeenCalledWith(
      user.id, 'ogretmen', SCHOOL_ID,
    )
  })
})

// ─────────────────────────────────────────────────────────────
describe('AnnouncementService.markRead()', () => {
  it('giriş yapılmamış → erken dönüş, repository çağrılmaz', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null)
    await AnnouncementService.markRead('ann-123')
    expect(AnnouncementRepository.markRead).not.toHaveBeenCalled()
  })

  it('giriş yapmış kullanıcı → repository.markRead çağrılır', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(user as never)
    vi.mocked(AnnouncementRepository.markRead).mockResolvedValue(undefined)
    await AnnouncementService.markRead('ann-123')
    expect(AnnouncementRepository.markRead).toHaveBeenCalledWith('ann-123', user.id)
  })
})

// ─────────────────────────────────────────────────────────────
describe('AnnouncementService.createAnnouncement()', () => {
  it('giriş yapılmamış → { error: "Giriş gerekli" }', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null)
    vi.mocked(getCurrentProfile).mockResolvedValue(null)
    const result = await AnnouncementService.createAnnouncement({
      message: 'Test duyurusu', target_roles: ['ogretmen'],
    })
    expect(result.error).toBe('Giriş gerekli')
    expect(AnnouncementRepository.create).not.toHaveBeenCalled()
  })

  it('öğretmen rolü duyuru oluşturamaz', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(user as never)
    vi.mocked(getCurrentProfile).mockResolvedValue(makeProfile('ogretmen', SCHOOL_ID) as never)
    const result = await AnnouncementService.createAnnouncement({
      message: 'İzinsiz duyuru', target_roles: ['ogretmen'],
    })
    expect(result.error).toBe('Bu işlem için yetkiniz yok')
    expect(AnnouncementRepository.create).not.toHaveBeenCalled()
  })

  it('zümre başkanı duyuru oluşturamaz', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(user as never)
    vi.mocked(getCurrentProfile).mockResolvedValue(makeProfile('zumre_baskani', SCHOOL_ID) as never)
    const result = await AnnouncementService.createAnnouncement({
      message: 'İzinsiz duyuru', target_roles: ['ogretmen'],
    })
    expect(result.error).toBe('Bu işlem için yetkiniz yok')
  })

  it('müdür geçerli hedef rollerle duyuru oluşturabilir', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(user as never)
    vi.mocked(getCurrentProfile).mockResolvedValue(makeProfile('mudur', SCHOOL_ID) as never)
    vi.mocked(AnnouncementRepository.create).mockResolvedValue({})
    const result = await AnnouncementService.createAnnouncement({
      message: 'Müdür duyurusu', target_roles: ['ogretmen', 'mudur_yardimcisi'],
    })
    expect(result.error).toBeUndefined()
    expect(AnnouncementRepository.create).toHaveBeenCalledOnce()
  })

  it('müdür yardımcısı geçerli hedeflerle duyuru oluşturabilir', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(user as never)
    vi.mocked(getCurrentProfile).mockResolvedValue(makeProfile('mudur_yardimcisi', SCHOOL_ID) as never)
    vi.mocked(AnnouncementRepository.create).mockResolvedValue({})
    const result = await AnnouncementService.createAnnouncement({
      message: 'MY duyurusu', target_roles: ['ogretmen', 'zumre_baskani'],
    })
    expect(result.error).toBeUndefined()
  })

  it('MY mudur_yardimcisi hedefleyemez', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(user as never)
    vi.mocked(getCurrentProfile).mockResolvedValue(makeProfile('mudur_yardimcisi', SCHOOL_ID) as never)
    const result = await AnnouncementService.createAnnouncement({
      message: 'Geçersiz hedef', target_roles: ['mudur_yardimcisi'],
    })
    expect(result.error).toBe('Geçersiz hedef grup seçimi')
    expect(AnnouncementRepository.create).not.toHaveBeenCalled()
  })

  it('müdür için geçersiz rol → hata döner', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(user as never)
    vi.mocked(getCurrentProfile).mockResolvedValue(makeProfile('mudur', SCHOOL_ID) as never)
    const result = await AnnouncementService.createAnnouncement({
      message: 'Test', target_roles: ['bilinmeyen_rol'],
    })
    expect(result.error).toBe('Geçersiz hedef grup seçimi')
  })
})

// ─────────────────────────────────────────────────────────────
describe('AnnouncementService.listSent()', () => {
  it('giriş yapılmamış → boş dizi döner', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null)
    expect(await AnnouncementService.listSent()).toEqual([])
  })

  it('giriş yapmış kullanıcı → repository.listByCreator çağrılır', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(user as never)
    vi.mocked(AnnouncementRepository.listByCreator).mockResolvedValue([])
    await AnnouncementService.listSent()
    expect(AnnouncementRepository.listByCreator).toHaveBeenCalledWith(user.id)
  })
})
