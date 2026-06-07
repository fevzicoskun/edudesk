import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/src/infrastructure/supabase/server', () => ({ createClient: vi.fn() }))

const { createClient }        = await import('@/src/infrastructure/supabase/server')
const { DashboardRepository } = await import('@/src/domains/dashboard/repositories/DashboardRepository')

const TEACHER_ID = 'teacher-repo-dash'
const SCHOOL_ID  = 'school-repo-dash'
const CLASS_ID   = 'class-repo-dash'

// Query chain — thenable (await için), tüm metotlar self döner (zincirleme için).
// Client ise ayrıca non-thenable; böylece `await createClient()` chain'i erken çözmez.
function makeChain(result: unknown = { data: null, error: null }) {
  const q: Record<string, unknown> = {}
  q.then  = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve)
  q.catch = () => Promise.resolve(result)
  for (const m of ['select','insert','update','delete','eq','in','is','not','gte','lte','order','limit','neq','single']) {
    q[m] = vi.fn().mockReturnValue(q)
  }
  return q as { [k: string]: ReturnType<typeof vi.fn> }
}

// Supabase client mock — from() metodu chain döner, kendisi thenable DEĞİL.
function makeClient(result: unknown = { data: null, error: null }) {
  const chain = makeChain(result)
  const db = { from: vi.fn().mockReturnValue(chain) }
  return { db, chain }
}

beforeEach(() => vi.clearAllMocks())

// ─── Boş dizi guard'ları ──────────────────────────────────────
// Bu guard'lar, boş array ile gereksiz DB sorgusu yapılmasını önler.

describe('DashboardRepository — boş dizi guard\'ları', () => {
  it('getSubmissions([]): createClient çağrılmaz, { data: [] } döner', async () => {
    const result = await DashboardRepository.getSubmissions([])
    expect(result).toEqual({ data: [] })
    expect(createClient).not.toHaveBeenCalled()
  })

  it('getAttendanceRows([],...): createClient çağrılmaz, { data: [] } döner', async () => {
    const result = await DashboardRepository.getAttendanceRows([], TEACHER_ID, '2026-01-01')
    expect(result).toEqual({ data: [] })
    expect(createClient).not.toHaveBeenCalled()
  })

  it('getStudentsByClasses([]): createClient çağrılmaz, { data: [] } döner', async () => {
    const result = await DashboardRepository.getStudentsByClasses([])
    expect(result).toEqual({ data: [] })
    expect(createClient).not.toHaveBeenCalled()
  })

  it('getWeeklySubmissionStats([],...): createClient çağrılmaz, { data: [] } döner', async () => {
    const result = await DashboardRepository.getWeeklySubmissionStats([], '2026-01-01')
    expect(result).toEqual({ data: [] })
    expect(createClient).not.toHaveBeenCalled()
  })

  it('getTodayClassAttendance([],...): createClient çağrılmaz, { data: [] } döner', async () => {
    const result = await DashboardRepository.getTodayClassAttendance([], '2026-06-07')
    expect(result).toEqual({ data: [] })
    expect(createClient).not.toHaveBeenCalled()
  })

  it('getAttendanceTrend([],...): createClient çağrılmaz, { data: [] } döner', async () => {
    const result = await DashboardRepository.getAttendanceTrend([], '2026-01-01')
    expect(result).toEqual({ data: [] })
    expect(createClient).not.toHaveBeenCalled()
  })
})

// ─── getClassSubmissions — iki aşamalı sorgu mantığı ─────────
// 1. ödev id'lerini çek; 2. submission sorgusunu `in` ile çalıştır.
// Ödev yoksa ikinci sorgu hiç yapılmamalı.

describe('DashboardRepository.getClassSubmissions()', () => {
  it('ödev yoksa ikinci sorgu atlanır, { data: [] } döner', async () => {
    const { db, chain } = makeClient({ data: [], error: null })
    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue(db)

    const result = await DashboardRepository.getClassSubmissions(CLASS_ID, TEACHER_ID, SCHOOL_ID)

    expect(result).toEqual({ data: [] })
    expect(chain.in).not.toHaveBeenCalled()
  })

  it('ödev varsa submissions `in` filtresiyle sorgulanır', async () => {
    const hwChain  = makeChain({ data: [{ id: 'hw-1' }], error: null })
    const subChain = makeChain({
      data: [{ homework_id: 'hw-1', student_id: 'stu-1', status: 'yapildi' }],
      error: null,
    })
    const db = { from: vi.fn().mockImplementation((table: string) =>
      table === 'homeworks' ? hwChain : subChain
    ) }
    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue(db)

    const result = await DashboardRepository.getClassSubmissions(CLASS_ID, TEACHER_ID, SCHOOL_ID)

    expect(subChain.in).toHaveBeenCalledWith('homework_id', ['hw-1'])
    expect(result).toEqual({
      data: [{ homework_id: 'hw-1', student_id: 'stu-1', status: 'yapildi' }],
      error: null,
    })
  })

  it('ödev data null gelirse ikinci sorgu atlanır', async () => {
    const { db, chain } = makeClient({ data: null, error: null })
    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue(db)

    const result = await DashboardRepository.getClassSubmissions(CLASS_ID, TEACHER_ID, SCHOOL_ID)

    expect(result).toEqual({ data: [] })
    expect(chain.in).not.toHaveBeenCalled()
  })
})

// ─── getTeacherHomeworks — temel sorgu parametreleri ─────────

describe('DashboardRepository.getTeacherHomeworks()', () => {
  it('teacher_id, school_id ve deleted_at filtresi uygulanır', async () => {
    const { db, chain } = makeClient({ data: [], error: null })
    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue(db)

    await DashboardRepository.getTeacherHomeworks(TEACHER_ID, SCHOOL_ID)

    expect(db.from).toHaveBeenCalledWith('homeworks')
    expect(chain.eq).toHaveBeenCalledWith('teacher_id', TEACHER_ID)
    expect(chain.eq).toHaveBeenCalledWith('school_id', SCHOOL_ID)
    expect(chain.is).toHaveBeenCalledWith('deleted_at', null)
  })
})
