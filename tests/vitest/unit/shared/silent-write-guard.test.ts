/**
 * "Sessiz yazma yasak" ailesi — kullanıcıya dönük her update/delete, hiçbir satıra
 * denk gelmediğinde (RLS reddi, başka okulun/kişinin kaydı, zaten silinmiş) açık hata
 * döndürmelidir. PostgREST 0 satırda hata vermez; kontrol edilmezse arayüz "başarılı"
 * der ama DB değişmez (2026-09-15 ödev silme olayı).
 *
 * Supabase client'ı: her zincir çağrısını kabul eden, await edilince 0 satır dönen sahte builder.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createAbility } from '@/src/shared/authorization'
import { OGRETMEN_PERMS } from '../../setup/factories'

const bosSonuc = { data: [], error: null, count: 0 }

function sahteBuilder(): unknown {
  const hedef = () => undefined
  return new Proxy(hedef, {
    get(_t, prop) {
      if (prop === 'then') return (res: (v: unknown) => void) => res(bosSonuc)
      return () => sahteBuilder()
    },
  })
}

vi.mock('@/src/infrastructure/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    from: () => sahteBuilder(),
    rpc: async () => ({ data: false, error: null }),
  })),
}))
vi.mock('@/src/shared/authorization/server', () => ({
  requireAbility: vi.fn(),
  getAbility: vi.fn(),
}))

const { requireAbility } = await import('@/src/shared/authorization/server')
const { TaskRepository } = await import('@/src/domains/tasks/repositories/TaskRepository')
const { DutyRepository } = await import('@/src/domains/schedule/repositories/DutyRepository')
const { CalendarRepository } = await import('@/src/domains/calendar/repositories/CalendarRepository')
const { MeetingRepository } = await import('@/src/domains/meetings/repositories/MeetingRepository')
const { ClassRepository } = await import('@/src/domains/classes/repositories/ClassRepository')
const { HomeworkSourceRepository } = await import('@/src/domains/homework/repositories/HomeworkSourceRepository')
const { MentorRepository } = await import('@/src/domains/mentor/repositories/MentorRepository')
const { ClassService } = await import('@/src/domains/classes/services/ClassService')

const ID = '11111111-1111-4111-8111-111111111111'
const U = 'user-1'
const S = 'school-1'

beforeEach(() => {
  vi.mocked(requireAbility).mockResolvedValue(
    createAbility({ userId: U, schoolId: S, permissions: OGRETMEN_PERMS }) as never,
  )
})

const repoYazmalari: [string, () => Promise<{ error: unknown }>][] = [
  ['TaskRepository.setDone',                 () => TaskRepository.setDone(ID, U, true)],
  ['TaskRepository.setSnooze',               () => TaskRepository.setSnooze(ID, U, '2026-09-20')],
  ['TaskRepository.deleteById',              () => TaskRepository.deleteById(ID, U)],
  ['DutyRepository.deleteById',              () => DutyRepository.deleteById(ID, U)],
  ['CalendarRepository.softDeleteEvent',     () => CalendarRepository.softDeleteEvent(ID, S, U)],
  ['MeetingRepository.updateStatus',         () => MeetingRepository.updateStatus(ID, U, S, 'yapildi' as never)],
  ['MeetingRepository.deleteById',           () => MeetingRepository.deleteById(ID, U, S)],
  ['ClassRepository.softDeleteStudent',      () => ClassRepository.softDeleteStudent(ID, S, U)],
  ['ClassRepository.restoreStudent',         () => ClassRepository.restoreStudent(ID, S)],
  ['ClassRepository.deleteStudentNote',      () => ClassRepository.deleteStudentNote(ID, U, S)],
  ['ClassRepository.deleteParentContactLog', () => ClassRepository.deleteParentContactLog(ID, U, S)],
  ['HomeworkSourceRepository.deactivate',    () => HomeworkSourceRepository.deactivate(ID, U, S)],
  ['MentorRepository.setClassMentor',        () => MentorRepository.setClassMentor(ID, U, S)],
]

describe('0 satıra denk gelen yazma açık hata döner', () => {
  it.each(repoYazmalari)('%s', async (_ad, cagir) => {
    const { error } = await cagir()
    expect(error).toEqual({ message: 'Kayıt bulunamadı veya yetkiniz yok.' })
  })

  it('ClassService.updateVeliContact', async () => {
    vi.mocked(requireAbility).mockResolvedValue(
      createAbility({ userId: U, schoolId: S, permissions: [
        ...OGRETMEN_PERMS,
        { resource: 'students', action: 'update', scope: 'school', source: 'role' },
      ] }) as never,
    )
    const r = await ClassService.updateVeliContact(ID, { email: null, telefon: '5550000000', ad: 'Veli' })
    expect(r.error).toBe('Kayıt bulunamadı veya yetkiniz yok.')
  })
})
