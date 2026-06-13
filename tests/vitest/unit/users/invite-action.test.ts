import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

vi.mock('@/src/domains/users/services/UserService', () => ({
  UserService: { invite: vi.fn() },
}))

vi.mock('@/src/lib/mailer', () => ({
  mailer: { sendMail: vi.fn() },
}))

vi.mock('@/src/shared/auth', () => ({
  getCurrentProfile: vi.fn(),
}))

vi.mock('@/src/infrastructure/observability/logger', () => ({
  logger: { error: vi.fn() },
}))

const { UserService }       = await import('@/src/domains/users/services/UserService')
const { mailer }            = await import('@/src/lib/mailer')
const { getCurrentProfile } = await import('@/src/shared/auth')
const { inviteUser }        = await import('@/app/actions/users')

function makeFormData(data: Record<string, string>): FormData {
  const fd = new FormData()
  Object.entries(data).forEach(([k, v]) => fd.append(k, v))
  return fd
}

const VALID_FD = makeFormData({
  email:     'ogretmen@test.com',
  full_name: 'Test Öğretmen',
  role:      'ogretmen',
})

beforeEach(() => { vi.clearAllMocks() })

describe('inviteUser — mail davranışı', () => {
  it('başarılı invite → mailer.sendMail doğru to ve subject ile çağrılır', async () => {
    vi.mocked(UserService.invite).mockResolvedValue({ success: true, tempPassword: 'TmpPass123' })
    vi.mocked(getCurrentProfile).mockResolvedValue({
      schools: { name: 'Mevlana Ortaokulu', slug: 'mevlana' },
    } as never)
    vi.mocked(mailer.sendMail).mockResolvedValue(undefined)

    const result = await inviteUser(undefined, VALID_FD)

    expect(result.success).toBe(true)
    expect(mailer.sendMail).toHaveBeenCalledOnce()
    expect(mailer.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to:      'ogretmen@test.com',
        subject: 'EduDesk — Giriş Bilgileriniz',
      })
    )
  })

  it('mailer hatası fırlatırsa action yine success: true döner (non-blocking)', async () => {
    vi.mocked(UserService.invite).mockResolvedValue({ success: true, tempPassword: 'TmpPass123' })
    vi.mocked(getCurrentProfile).mockResolvedValue({
      schools: { name: 'Test Okulu', slug: 'test' },
    } as never)
    vi.mocked(mailer.sendMail).mockRejectedValue(new Error('SMTP bağlantı hatası'))

    const result = await inviteUser(undefined, VALID_FD)

    expect(result.success).toBe(true)
    expect(result.error).toBeUndefined()
  })

  it('UserService.invite hata döndürünce mailer hiç çağrılmaz', async () => {
    vi.mocked(UserService.invite).mockResolvedValue({ error: 'Bu e-posta zaten kayıtlı' })

    const result = await inviteUser(undefined, VALID_FD)

    expect(result.error).toBe('Bu e-posta zaten kayıtlı')
    expect(mailer.sendMail).not.toHaveBeenCalled()
  })
})
