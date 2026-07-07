import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/src/infrastructure/supabase/server', () => ({ createClient: vi.fn() }))

const { createClient }     = await import('@/src/infrastructure/supabase/server')
const { ClassRepository }  = await import('@/src/domains/classes/repositories/ClassRepository')

const SCHOOL_ID  = 'school-cls-repo'
const CLASS_ID   = 'class-cls-repo'
const STUDENT_ID = 'student-cls-repo'
const TEACHER_ID = 'teacher-cls-repo'
const NOTE_ID    = 'note-cls-repo'

// Query chain — thenable (await için), tüm metotlar self döner (zincirleme için).
// Supabase client ise non-thenable; böylece `await createClient()` chain'i erken çözmez.
function makeChain(result: unknown = { data: null, error: null }) {
  const q: Record<string, unknown> = {}
  q.then  = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve)
  q.catch = () => Promise.resolve(result)
  for (const m of ['select','insert','update','delete','eq','in','is','not','gte','lte','order','limit','neq','single']) {
    q[m] = vi.fn().mockReturnValue(q)
  }
  return q as { [k: string]: ReturnType<typeof vi.fn> }
}

function makeClient(result: unknown = { data: null, error: null }) {
  const chain = makeChain(result)
  const db = {
    from: vi.fn().mockReturnValue(chain),
    rpc:  vi.fn().mockResolvedValue({ data: null, error: null }),
  }
  return { db, chain }
}

beforeEach(() => vi.clearAllMocks())

// ─── Tenant izolasyonu — school_id filtresi ─────────────────
// Güvenlik açısından en kritik testler: her mutasyon school_id'yi kontrol etmeli.

describe('ClassRepository — tenant izolasyonu', () => {
  it('softDeleteClassCascade: RPC class_id VE school_id parametreleriyle çağrılır', async () => {
    const { db } = makeClient()
    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue(db)

    await ClassRepository.softDeleteClassCascade(CLASS_ID, SCHOOL_ID)

    expect(db.rpc).toHaveBeenCalledWith('soft_delete_class_cascade', {
      p_class_id: CLASS_ID, p_school_id: SCHOOL_ID,
    })
  })

  it('softDeleteStudent: student_id VE school_id filtresi uygulanır', async () => {
    const { db, chain } = makeClient()
    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue(db)

    await ClassRepository.softDeleteStudent(STUDENT_ID, SCHOOL_ID, TEACHER_ID)

    expect(db.from).toHaveBeenCalledWith('students')
    expect(chain.eq).toHaveBeenCalledWith('id', STUDENT_ID)
    expect(chain.eq).toHaveBeenCalledWith('school_id', SCHOOL_ID)
  })

  it('deleteStudentNote: note_id, teacher_id VE school_id üçlü filtresi uygulanır', async () => {
    const { db, chain } = makeClient()
    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue(db)

    await ClassRepository.deleteStudentNote(NOTE_ID, TEACHER_ID, SCHOOL_ID)

    expect(db.from).toHaveBeenCalledWith('student_notes')
    expect(chain.delete).toHaveBeenCalled()
    expect(chain.eq).toHaveBeenCalledWith('id', NOTE_ID)
    expect(chain.eq).toHaveBeenCalledWith('teacher_id', TEACHER_ID)
    expect(chain.eq).toHaveBeenCalledWith('school_id', SCHOOL_ID)
  })
})

// ─── Find — deleted_at null guard + tenant ─────────────────
// findClass/findStudent: arama sorgularında deleted_at kontrolü olmalı.

describe('ClassRepository — find metotları', () => {
  it('findClassInSchool: id, school_id VE deleted_at null filtresi + single() çağrısı', async () => {
    const { db, chain } = makeClient({ data: { id: CLASS_ID }, error: null })
    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue(db)

    await ClassRepository.findClassInSchool(CLASS_ID, SCHOOL_ID)

    expect(db.from).toHaveBeenCalledWith('classes')
    expect(chain.eq).toHaveBeenCalledWith('id', CLASS_ID)
    expect(chain.eq).toHaveBeenCalledWith('school_id', SCHOOL_ID)
    expect(chain.is).toHaveBeenCalledWith('deleted_at', null)
    expect(chain.single).toHaveBeenCalled()
  })

  it('findStudentInSchool: id, school_id VE deleted_at null filtresi + single() çağrısı', async () => {
    const { db, chain } = makeClient({ data: { id: STUDENT_ID }, error: null })
    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue(db)

    await ClassRepository.findStudentInSchool(STUDENT_ID, SCHOOL_ID)

    expect(db.from).toHaveBeenCalledWith('students')
    expect(chain.eq).toHaveBeenCalledWith('id', STUDENT_ID)
    expect(chain.eq).toHaveBeenCalledWith('school_id', SCHOOL_ID)
    expect(chain.is).toHaveBeenCalledWith('deleted_at', null)
    expect(chain.single).toHaveBeenCalled()
  })
})

// ─── Restore — deleted_at null setleme ─────────────────────
// Geri yükleme: deleted_at ve deleted_by null'a setlenmeli.

describe('ClassRepository — geri yükleme (restore)', () => {
  it('restoreClassCascade: RPC class_id VE school_id parametreleriyle çağrılır', async () => {
    const { db } = makeClient()
    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue(db)

    await ClassRepository.restoreClassCascade(CLASS_ID, SCHOOL_ID)

    expect(db.rpc).toHaveBeenCalledWith('restore_class_cascade', {
      p_class_id: CLASS_ID, p_school_id: SCHOOL_ID,
    })
  })

  it('restoreStudent: deleted_at ve deleted_by null setlenir, school_id filtresi korunur', async () => {
    const { db, chain } = makeClient()
    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue(db)

    await ClassRepository.restoreStudent(STUDENT_ID, SCHOOL_ID)

    expect(chain.update).toHaveBeenCalledWith({ deleted_at: null, deleted_by: null })
    expect(chain.eq).toHaveBeenCalledWith('id', STUDENT_ID)
    expect(chain.eq).toHaveBeenCalledWith('school_id', SCHOOL_ID)
  })

})

// ─── Insert — doğru tablo ve veri ─────────────────────────

describe('ClassRepository — insert metotları', () => {
  it('insertClass: classes tablosuna doğru veriyle insert yapılır', async () => {
    const { db, chain } = makeClient()
    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue(db)

    const data = { name: '10-A', grade: 10, academic_year: '2025-2026', school_id: SCHOOL_ID }
    await ClassRepository.insertClass(data)

    expect(db.from).toHaveBeenCalledWith('classes')
    expect(chain.insert).toHaveBeenCalledWith(data)
  })

  it('insertStudent: students tablosuna doğru veriyle insert yapılır', async () => {
    const { db, chain } = makeClient()
    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue(db)

    const data = { class_id: CLASS_ID, full_name: 'Ali Veli', student_number: '042', school_id: SCHOOL_ID }
    await ClassRepository.insertStudent(data)

    expect(db.from).toHaveBeenCalledWith('students')
    expect(chain.insert).toHaveBeenCalledWith(data)
  })

  it('insertStudents: birden fazla satır tek insert ile eklenir', async () => {
    const { db, chain } = makeClient()
    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue(db)

    const rows = [
      { class_id: CLASS_ID, full_name: 'Ayşe Nur', student_number: '001', school_id: SCHOOL_ID },
      { class_id: CLASS_ID, full_name: 'Mehmet Can', student_number: '002', school_id: SCHOOL_ID },
    ]
    await ClassRepository.insertStudents(rows)

    expect(db.from).toHaveBeenCalledWith('students')
    expect(chain.insert).toHaveBeenCalledWith(rows)
  })

  it('insertStudentNote: student_notes tablosuna doğru veriyle insert yapılır', async () => {
    const { db, chain } = makeClient()
    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue(db)

    const data = { teacher_id: TEACHER_ID, student_id: STUDENT_ID, body: 'Derse ilgili', school_id: SCHOOL_ID }
    await ClassRepository.insertStudentNote(data)

    expect(db.from).toHaveBeenCalledWith('student_notes')
    expect(chain.insert).toHaveBeenCalledWith(data)
  })
})
