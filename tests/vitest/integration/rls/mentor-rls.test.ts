/**
 * Mentor RLS erişim sınır testleri.
 *
 * NOT: mentor_reports tablosu DB'de mevcuttur (migrations/2026-05-19).
 * Sınıf rehberliği (mentor_reports) uygulama katmanı 2026-06-17'de eklendi:
 * MentorRepository/MentorService/app/actions/mentor.ts + sınıf detayı (atama) ve
 * öğrenci profili (raporlar) UI'ı. assignClassMentor için ayrıca unit test vardır
 * (tests/vitest/unit/mentor/). Bu dosya yalnızca RLS politikalarının doğruluğunu doğrular.
 *
 * mentor_reports (mentörlük görüşme notları):
 *    - Not ekleme yetkisi artık sınıf rehberliğinden (classes.mentor_teacher_id) değil,
 *      kişisel mentörlük bağından gelir (mentorships: mentor_id + student_id + school_id)
 *      — 2026-09-16 spec kararı, bkz. migrations/20260916140000_mentorluk.sql
 *    - Raporu yazan mentor silebilir, başkaları silemez
 *    - Okuma: YALNIZ raporu yazan mentör — yönetici rolleri dahil (mudur, mudur_yardimcisi,
 *      zumre_baskani) kimse başkasının notunu okuyamaz (hassas aile/özel durum bilgisi)
 *
 * Saldırı vektörleri (yorum olarak belgelenmiştir):
 *   A. mentorships bağı olmadan rapor ekleme girişimi
 *   B. mentor_id taklit: Başka öğretmen adına rapor ekleme
 *   C. Cross-school: Okul B öğretmeni Okul A verilerine erişim
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
let mentorTeacher:   TestUser  // studentId için kişisel mentörlük bağı olan mentor
let otherTeacher:    TestUser  // aynı okul, mentörlük bağı yok
let manager:         TestUser  // mudur_yardimcisi — spec kararıyla artık rapor okuyamaz
let teacherB:        TestUser  // başka okul öğretmeni

let tokenMentor:  string
let tokenOther:   string
let tokenManager: string
let tokenB:       string

let classId:   string  // öğrencilerin bulunduğu sınıf
let studentId: string  // mentorTeacher'ın mentörlük listesindeki öğrenci
let studentIdNoMentorship: string  // aynı sınıfta, mentörlük bağı OLMAYAN öğrenci
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

  const { data: cls } = await serviceDb
    .from('classes')
    .insert({ name: 'Mentor Test Sınıfı', grade: 10, academic_year: '2025-2026', school_id: school.id })
    .select('id').single()
  classId = cls!.id

  // Sınıfa öğrenci ekle (mentorTeacher'ın mentörlük listesindeki öğrenci)
  const { data: stu } = await serviceDb
    .from('students')
    .insert({ full_name: 'Mentor Test Öğrenci', student_number: null, class_id: classId, school_id: school.id })
    .select('id').single()
  studentId = stu!.id

  // Aynı sınıfta, kimseyle mentörlük bağı OLMAYAN ikinci öğrenci
  const { data: stu2 } = await serviceDb
    .from('students')
    .insert({ full_name: 'Mentörlüksüz Öğrenci', student_number: null, class_id: classId, school_id: school.id })
    .select('id').single()
  studentIdNoMentorship = stu2!.id

  // mentorTeacher'ı studentId için kişisel mentörlük listesine ekle — yeni yetki modelinin temeli
  await serviceDb.from('mentorships').insert({
    mentor_id:  mentorTeacher.id,
    student_id: studentId,
    school_id:  school.id,
  })

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

  it('mudur_yardimcisi okuyamaz — notlar yalnız mentöre özeldir', async () => {
    // Spec kararı: aile/özel durum bilgisi hassas; yönetici rolleri de erişemez
    await assertCannotRead(createUserClient(tokenManager), 'mentor_reports', reportId, 'manager')
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
describe('mentor_reports INSERT: sadece mentörlük listesindeki mentör yazabilir', () => {
  const baseRow = () => ({
    student_id:  studentId,
    class_id:    classId,
    school_id:   school.id,
    content:     'Yeni rapor içeriği — en az 5 karakter',
    report_date: '2026-05-15',
  })

  it('mentörlük listesindeki öğrenci için rapor ekleyebilir', async () => {
    const client = createUserClient(tokenMentor)
    const { error } = await client.from('mentor_reports').insert({
      ...baseRow(),
      mentor_id: mentorTeacher.id,
    })
    expect(error).toBeNull()
  })

  it('mentörlük listesinde olmayan öğrenciye rapor eklenemez', async () => {
    // mentorships bağı yoksa RLS reddeder — yeni yetki modelinin özü
    await assertInsertBlocked(
      createUserClient(tokenMentor),
      'mentor_reports',
      { ...baseRow(), student_id: studentIdNoMentorship, mentor_id: mentorTeacher.id },
      'not in mentorship list'
    )
  })

  it('mentor olmayan öğretmen rapor ekleyemez — mentörlük bağı yok', async () => {
    // Saldırı A: mentorships kaydı olmayan öğretmen rapor ekleme girişimi
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

// NOT: mentorships DELETE ("sessiz silme yasak" kuralı) testi ayrı bir dosyaya taşındı:
// tests/vitest/integration/rls/mentorships-rls.test.ts — orada createClient() mock'lanıp
// gerçek MentorRepository.deleteMentorship fonksiyonu çağrılıyor (bu dosyanın mock'suz
// createUserClient deseniyle repository koduna doğrudan erişim mümkün değil).
