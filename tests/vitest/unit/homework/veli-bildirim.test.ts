import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createAbility } from '@/src/shared/authorization'
import { OGRETMEN_PERMS } from '../../setup/factories'
import type { GrantedPermission } from '@/src/domains/rbac/types'

const SCHOOL_HW_PERMS: GrantedPermission[] = [
  ...OGRETMEN_PERMS,
  { resource: 'homework', action: 'update', scope: 'school', source: 'role' },
]

vi.mock('@/src/shared/authorization/server', () => ({
  getAbility: vi.fn(),
}))

vi.mock('@/src/infrastructure/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/src/lib/mailer', () => ({
  mailer: { sendMail: vi.fn() },
}))

const { getAbility }   = await import('@/src/shared/authorization/server')
const { createClient } = await import('@/src/infrastructure/supabase/server')
const { mailer }       = await import('@/src/lib/mailer')
const { sendHomeworkReminderEmails } = await import('@/app/actions/veli-bildirim')

const SCHOOL_ID  = 'school-1'
const TEACHER_ID = 'teacher-1'

function makeAbility(perms = OGRETMEN_PERMS, userId = TEACHER_ID) {
  return createAbility({ userId, schoolId: SCHOOL_ID, permissions: perms })
}

beforeEach(() => { vi.clearAllMocks() })

describe('sendHomeworkReminderEmails()', () => {
  it('giriş yoksa { error } döner', async () => {
    vi.mocked(getAbility).mockResolvedValue(null)
    const result = await sendHomeworkReminderEmails('3fa85f64-5717-4562-b3fc-2c963f66afa6', ['3fa85f64-5717-4562-b3fc-2c963f66afa7'])
    expect(result.error).toBe('Giriş gerekli')
    expect(mailer.sendMail).not.toHaveBeenCalled()
  })

  it('homework:update izni yoksa hata döner', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility([]) as never)
    const result = await sendHomeworkReminderEmails('3fa85f64-5717-4562-b3fc-2c963f66afa6', ['3fa85f64-5717-4562-b3fc-2c963f66afa7'])
    expect(result.error).toBe('Bu işlem için yetkiniz yok.')
  })

  it('boş studentIds ile sent=0 döner, mail gönderilmez', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility() as never)
    const result = await sendHomeworkReminderEmails('3fa85f64-5717-4562-b3fc-2c963f66afa6', [])
    expect(result.sent).toBe(0)
    expect(mailer.sendMail).not.toHaveBeenCalled()
  })
})
