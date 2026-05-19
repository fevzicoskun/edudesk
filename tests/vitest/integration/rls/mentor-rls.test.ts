/**
 * Mentor RLS erişim sınır testleri.
 *
 * İki ayrı mentor sistemi test edilir:
 *
 * 1. mentor_reports (sistem öğrencileri için)
 *    - Sadece sınıfın mentor_teacher_id'sine atanmış öğretmen rapor ekleyebilir
 *    - Raporu yazan mentor silebilir, başkaları silemez
 *    - Okuma: sadece kendi + yöneticiler (mudur, mudur_yardimcisi, zumre_baskani)
 *
 * 2. mentor_students (kişisel defter — manuel öğrenciler)
 *    - Öğretmen sadece kendi oluşturduğu öğrencileri görebilir
 *    - Aynı okuldaki başka öğretmen göremez (teacher_id = auth.uid())
 *    - Cross-school: başka okul kullanıcısı hiç göremez
 *
 * Saldırı vektörleri (yorum olarak belgelenmiştir):
 *   A. class_id değiştirme: Mentör olmayan sınıf için rapor ekleme girişimi
 *   B. mentor_id taklit: Başka öğretmen adına rapor ekleme
 *   C. Cross-school: Okul B öğretmeni Okul A verilerine erişim
 *   D. teacher_id taklit: Başka öğretmenin mentor_student'ını okuma/yazma
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import {
  serviceDb,
  createUserClient,
  createTestSchool,
  createTestUser,
  signInTestUser,
  cleanupTestData,
  type TestSchool,
  type TestUser,
} from '../../setup/db'
import { assertCanRead, assertCannotRead, assertInsertBlocked, assertDeleteBlocked } from './rls-assert'

// ─── Fixture ─────────────────────────────────────────────────────────────────

let school:          TestSchool
let schoolB:         TestSchool
let mentorTeacher:   TestUser  // class'a atanmış mentor
let otherTeacher:    TestUser  // aynı okul, mentor değil
let manager:         TestUser  // mudur_yardimcisi — rapor okuyabilir
let teacherB:        TestUser  // başka okul öğretmeni

let tokenMentor:  string
let tokenOther:   string
let tokenManager: string
let tokenB:       string

let classId:   string  // mentorTeacher'ın atandığı sınıf
let classNoMentor: string  // mentor atanmamış sınıf
let studentId: string  // classId içindeki öğrenci
let reportId:  string  // mentorTeacher'ın eklediği rapor

beforeAll(async () => {
  ;[school, schoolB] = await Promise.all([
    createTestSchool('_MENTOR'),
    createTestSchool('_MENTOR_B'),
  ])

  ;[mentorTeacher, otherTeacher, manager, teacherB] = await Promise.all([
    createTestUser({ role: 'ogretmen',         schoolId: school.id }),
    createTestUser({ role: 'ogretmen',         schoolId: school.id }),
    createTestUser({ role: 'mudur_yardimcisi', schoolId: school.id }),
    createTestUser({ role: 'ogretmen',         schoolId: schoolB.id }),
  ])

  ;[tokenMentor, tokenOther, tokenManager, tokenB] = await Promise.all([
    signInTestUser(mentorTeacher.email, mentorTeacher.password),
    signInTestUser(otherTeacher.email,  otherTeacher.password),
    signInTestUser(manager.email,       manager.password),
    signInTestUser(teacherB.email,      teacherB.password),
  ])

  // mentorTeacher'ı sınıfa mentor olarak ata
  const { data: cls } = await serviceDb
    .from('classes')
    .insert({
      name: 'Mentor Test Sınıfı', grade: 10, academic_year: '2025-2026',
      school_id: school.id,
      mentor_teacher_id: mentorTeacher.id,
    })
    .select('id').single()
  classId = cls!.id

  // Mentor atanmamış sınıf
  const { data: cls2 } = await serviceDb
    .from('classes')
    .insert({ name: 'Mentor Yok Sınıfı', grade: 11, academic_year: '2025-2026', school_id: school.id })
    .select('id').single()
  classNoMentor = cls2!.id

  // Sınıfa öğrenci ekle
  const { data: stu } = await serviceDb
    .from('students')
    .insert({ full_name: 'Mentor Test Öğrenci', student_number: null, class_id: classId, school_id: school.id })
    .select('id').single()
  studentId = stu!.id

  // mentorTeacher adına servis clienti ile rapor ekle (read testleri için)
  const { data: rpt } = await serviceDb
    .from('mentor_reports')
    .insert({
      mentor_id:   mentorTeacher.id,
      student_id:  studentId,
      class_id:    classId,
      school_id:   school.id,
      content:     'Test raporu içeriği',
      report_date: '2026-05-01',
    })
    .select('id').single()
  reportId = rpt!.id
})

afterAll(async () => {
  await cleanupTestData({
    userIds:  [mentorTeacher.id, otherTeacher.id, manager.id, teacherB.id],
    schoolIds: [school.id, schoolB.id],
  })
})

// ─── mentor_reports SELECT politikası ────────────────────────────────────────
describe('mentor_reports SELECT: kimler okuyabilir', () => {
  it('mentörün kendisi kendi raporunu okuyabilir', async () => {
    await assertCanRead(createUserClient(tokenMentor), 'mentor_reports', reportId, 'mentor')
  })

  it('mudur_yardimcisi tüm okul raporlarını okuyabilir', async () => {
    await assertCanRead(createUserClient(tokenManager), 'mentor_reports', reportId, 'manager')
  })

  it('aynı okuldaki başka öğretmen okuyamaz', async () => {
    // Saldırı A parçası: aynı okuldaki öğretmen başkasının mentor raporuna erişemez
    await assertCannotRead(createUserClient(tokenOther), 'mentor_reports', reportId, 'other-teacher')
  })

  it('başka okul öğretmeni hiç okuyamaz', async () => {
    // Saldırı C: cross-school okuma girişimi
    await assertCannotRead(createUserClient(tokenB), 'mentor_reports', reportId, 'school-b')
  })
})

// ─── mentor_reports INSERT politikası ────────────────────────────────────────
describe('mentor_reports INSERT: sadece atanmış mentor yazabilir', () => {
  const baseRow = () => ({
    student_id:  studentId,
    class_id:    classId,
    school_id:   school.id,
    content:     'Yeni rapor içeriği — en az 5 karakter',
    report_date: '2026-05-15',
  })

  it('mentör kendi atandığı sınıf için rapor ekleyebilir', async () => {
    const client = createUserClient(tokenMentor)
    const { error } = await client.from('mentor_reports').insert({
      ...baseRow(),
      mentor_id: mentorTeacher.id,
    })
    expect(error).toBeNull()
  })

  it('mentor olmayan öğretmen rapor ekleyemez — sınıfa atanmamış', async () => {
    // Saldırı A: mentor_teacher_id = NULL olan sınıf için rapor ekleme girişimi
    await assertInsertBlocked(
      createUserClient(tokenOther),
      'mentor_reports',
      { ...baseRow(), mentor_id: otherTeacher.id },
      'non-mentor teacher'
    )
  })

  it('mentor, başka öğretmenin adına rapor ekleyemez — mentor_id taklit', async () => {
    // Saldırı B: mentor_id = otherTeacher.id ile sahte rapor
    // Policy: mentor_id = auth.uid() kontrolü
    await assertInsertBlocked(
      createUserClient(tokenMentor),
      'mentor_reports',
      { ...baseRow(), mentor_id: otherTeacher.id },
      'mentor_id spoof'
    )
  })

  it('başka okul öğretmeni rapor ekleyemez — cross-school', async () => {
    // Saldırı C: okul B öğretmeni okul A sınıfı için rapor
    await assertInsertBlocked(
      createUserClient(tokenB),
      'mentor_reports',
      { ...baseRow(), mentor_id: teacherB.id, school_id: school.id },
      'cross-school insert'
    )
  })
})

// ─── mentor_reports DELETE politikası ────────────────────────────────────────
describe('mentor_reports DELETE: sadece yazan mentör silebilir', () => {
  it('başka öğretmen mentor raporunu silemez', async () => {
    await assertDeleteBlocked(
      createUserClient(tokenOther),
      'mentor_reports',
      reportId,
      serviceDb,
      'other-teacher-delete'
    )
  })

  it('başka okul öğretmeni silemez', async () => {
    await assertDeleteBlocked(
      createUserClient(tokenB),
      'mentor_reports',
      reportId,
      serviceDb,
      'cross-school-delete'
    )
  })
})

// ─── mentor_students tablosu (kişisel defter) ─────────────────────────────────
describe('mentor_students: teacher_id izolasyonu', () => {
  let msId: string  // mentorTeacher'ın oluşturduğu öğrenci

  beforeAll(async () => {
    // service ile doğrudan ekle — test verisi
    const { data } = await serviceDb
      .from('mentor_students')
      .insert({
        teacher_id: mentorTeacher.id,
        school_id:  school.id,
        full_name:  'Manuel Test Öğrenci',
        parent_name: 'Veli Adı',
        phone:      '05001234567',
      })
      .select('id').single()
    msId = data!.id
  })

  it('oluşturan öğretmen kendi manuel öğrencisini görebilir', async () => {
    await assertCanRead(createUserClient(tokenMentor), 'mentor_students', msId, 'owner')
  })

  it('aynı okuldaki başka öğretmen göremez — teacher_id = auth.uid() koşulu', async () => {
    // Saldırı D: aynı okul içi horizontal privilege escalation
    await assertCannotRead(createUserClient(tokenOther), 'mentor_students', msId, 'same-school-other')
  })

  it('başka okul öğretmeni hiç göremez', async () => {
    // Saldırı C: cross-school
    await assertCannotRead(createUserClient(tokenB), 'mentor_students', msId, 'cross-school')
  })

  it('başka öğretmen yanlış teacher_id ile insert edemez', async () => {
    // Saldırı D: INSERT ile teacher_id = mentorTeacher.id taklit etme
    // Policy WITH CHECK (teacher_id = auth.uid()) engeller
    await assertInsertBlocked(
      createUserClient(tokenOther),
      'mentor_students',
      {
        teacher_id:  mentorTeacher.id,  // başkasının ID'si!
        school_id:   school.id,
        full_name:   'Sahte Öğrenci',
      },
      'teacher_id spoof'
    )
  })

  it('başka öğretmen kendi adıyla da (doğru teacher_id) aynı okula ekleyemez mi?', async () => {
    // Bu geçerli: her öğretmen kendi kişisel defterine öğrenci ekleyebilir
    // Policy: teacher_id = auth.uid() AND school_id = current_school_id()
    const client = createUserClient(tokenOther)
    const { error } = await client.from('mentor_students').insert({
      teacher_id: otherTeacher.id,
      school_id:  school.id,
      full_name:  'Other Teacher Manuel Öğrenci',
    })
    expect(error).toBeNull()  // kendi adına ekleyebilir — bu beklenen davranış
  })
})

// ─── mentor_student_notes tablosu ────────────────────────────────────────────
describe('mentor_student_notes: cross-teacher izolasyonu', () => {
  let msId2: string
  let noteId: string

  beforeAll(async () => {
    // mentorTeacher'ın kendi öğrencisi
    const { data: ms } = await serviceDb
      .from('mentor_students')
      .insert({ teacher_id: mentorTeacher.id, school_id: school.id, full_name: 'Not Test Öğrencisi' })
      .select('id').single()
    msId2 = ms!.id

    // Service ile not ekle
    const { data: note } = await serviceDb
      .from('mentor_student_notes')
      .insert({
        mentor_student_id: msId2,
        teacher_id:        mentorTeacher.id,
        school_id:         school.id,
        content:           'Test notu içeriği',
      })
      .select('id').single()
    noteId = note!.id
  })

  it('notun sahibi kendi notunu okuyabilir', async () => {
    await assertCanRead(createUserClient(tokenMentor), 'mentor_student_notes', noteId, 'owner')
  })

  it('başka öğretmen notu okuyamaz', async () => {
    await assertCannotRead(createUserClient(tokenOther), 'mentor_student_notes', noteId, 'other-teacher')
  })

  it('başka okul öğretmeni notu okuyamaz', async () => {
    await assertCannotRead(createUserClient(tokenB), 'mentor_student_notes', noteId, 'cross-school')
  })

  it('başka öğretmen notu silemez', async () => {
    await assertDeleteBlocked(
      createUserClient(tokenOther),
      'mentor_student_notes',
      noteId,
      serviceDb,
      'other-delete'
    )
  })
})
