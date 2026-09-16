import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createAbility } from '@/src/shared/authorization'
import { OGRETMEN_PERMS } from '../../setup/factories'

vi.mock('@/src/shared/authorization/server', () => ({
  requireAbility: vi.fn(),
  getAbility: vi.fn(),
}))
vi.mock('@/src/domains/mentor/repositories/MentorRepository', () => ({
  MentorRepository: {
    getMentorProfile: vi.fn(),
    upsertMentorProfile: vi.fn(),
    findMentorship: vi.fn(),
  },
}))

const { requireAbility } = await import('@/src/shared/authorization/server')
const { MentorRepository } = await import('@/src/domains/mentor/repositories/MentorRepository')
const { MentorService } = await import('@/src/domains/mentor/services/MentorService')

const TEACHER_ID = 'teacher-1'
const SCHOOL_ID = 'school-1'
const STUDENT_ID = '11111111-1111-4111-8111-111111111111'

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireAbility).mockResolvedValue(
    createAbility({ userId: TEACHER_ID, schoolId: SCHOOL_ID, permissions: OGRETMEN_PERMS }) as never,
  )
  vi.mocked(MentorRepository.findMentorship).mockResolvedValue({ data: { id: 'm1' } } as never)
})

describe('MentorService.saveMentorProfile()', () => {
  it('mentor_id ve school_id sunucudan konur, istemciden alınmaz', async () => {
    vi.mocked(MentorRepository.upsertMentorProfile).mockResolvedValue({ error: null } as never)

    await MentorService.saveMentorProfile(STUDENT_ID, { goals_short: 'TYT netini artırmak' })

    const arg = vi.mocked(MentorRepository.upsertMentorProfile).mock.calls[0][0] as Record<string, unknown>
    expect(arg.mentor_id).toBe(TEACHER_ID)
    expect(arg.school_id).toBe(SCHOOL_ID)
    expect(arg.student_id).toBe(STUDENT_ID)
    expect(arg.goals_short).toBe('TYT netini artırmak')
  })

  it('2000 karakteri aşan alan reddedilir', async () => {
    const result = await MentorService.saveMentorProfile(STUDENT_ID, { interests: 'a'.repeat(2001) })
    expect(result.error).toBeTruthy()
    expect(MentorRepository.upsertMentorProfile).not.toHaveBeenCalled()
  })

  it('kişisel listede olmayan (veya başka okulun) öğrencisine profil yazılamaz', async () => {
    vi.mocked(MentorRepository.findMentorship).mockResolvedValue({ data: null } as never)
    const result = await MentorService.saveMentorProfile(STUDENT_ID, { goals_short: 'x' })
    expect(result.error).toBe('Bu öğrenci mentörlük listenizde değil')
    expect(MentorRepository.findMentorship).toHaveBeenCalledWith(STUDENT_ID, TEACHER_ID, SCHOOL_ID)
    expect(MentorRepository.upsertMentorProfile).not.toHaveBeenCalled()
  })
})

describe('MentorService.markRulesExplained()', () => {
  it('rules_explained_at bugünün tarihiyle yazılır', async () => {
    vi.mocked(MentorRepository.upsertMentorProfile).mockResolvedValue({ error: null } as never)

    await MentorService.markRulesExplained(STUDENT_ID)

    const arg = vi.mocked(MentorRepository.upsertMentorProfile).mock.calls[0][0] as Record<string, unknown>
    expect(arg.rules_explained_at).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(arg.mentor_id).toBe(TEACHER_ID)
  })

  it('kişisel listede olmayan öğrenci için işaretlenemez', async () => {
    vi.mocked(MentorRepository.findMentorship).mockResolvedValue({ data: null } as never)
    const result = await MentorService.markRulesExplained(STUDENT_ID)
    expect(result.error).toBe('Bu öğrenci mentörlük listenizde değil')
    expect(MentorRepository.upsertMentorProfile).not.toHaveBeenCalled()
  })
})
