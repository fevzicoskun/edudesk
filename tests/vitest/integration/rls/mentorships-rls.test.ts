/**
 * MentorRepository.deleteMentorship — "sessiz silme yasak" kuralının gerçek
 * fonksiyona ve gerçek Supabase/RLS yanıtına karşı doğrulanması.
 *
 * Bulgu 3 (task-3 review, re-review 2026-09-16): İlk tur bu mantığı yerel bir
 * kopyada (deleteMentorshipLike) test etmişti — kopya repository'nin gerçek kodunu
 * ÇAĞIRMIYORDU. Repository'de regresyon olsa (ör. `.select('id')` satırı silinse,
 * ki bu projede canlıda tam olarak bu hata yaşanmıştı) test bunu yakalamazdı.
 *
 * Bu dosya createClient()'ı mock'layıp GERÇEK MentorRepository.deleteMentorship
 * fonksiyonunu çağırır. Mock hedefi createUserClient(token) — yani anon key +
 * gerçek kullanıcı JWT'si — olduğu için RLS aktif kalır (serviceDb gibi bypass etmez).
 *
 * Desen kaynağı: tests/vitest/integration/server-actions/{homework,user}-service.test.ts
 * (orada createClient() mock hedefi serviceDb'dir; burada RLS'i test ettiğimiz için
 * hedef createUserClient(token) olarak değiştirildi).
 *
 * Her test kendi öğrenci + mentörlük kaydını oluşturur (sıra bağımsız) — re-review notu.
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
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

vi.mock('@/src/infrastructure/supabase/server', () => ({
  createClient: vi.fn(),
}))

const { createClient } = await import('@/src/infrastructure/supabase/server')
const { MentorRepository } = await import('@/src/domains/mentor/repositories/MentorRepository')

let school:        TestSchool
let mentorTeacher: TestUser  // mentörlük kaydının gerçek sahibi
let otherTeacher:  TestUser  // aynı okul, mentörlük bağı yok
let tokenMentor:   string
let tokenOther:    string
let classId:       string

beforeAll(async () => {
  school = await createTestSchool('_MENTORSHIPS_DEL')

  ;[mentorTeacher, otherTeacher] = await Promise.all([
    createTestUser({ role: 'ogretmen', schoolId: school.id }),
    createTestUser({ role: 'ogretmen', schoolId: school.id }),
  ])

  ;[tokenMentor, tokenOther] = await Promise.all([
    signInTestUser(mentorTeacher.email, mentorTeacher.password),
    signInTestUser(otherTeacher.email,  otherTeacher.password),
  ])

  const { data: cls } = await serviceDb
    .from('classes')
    .insert({ name: 'Mentörlük Silme Test Sınıfı', grade: 10, academic_year: '2025-2026', school_id: school.id })
    .select('id').single()
  classId = cls!.id
})

afterAll(async () => {
  await cleanupTestData({
    userIds:   [mentorTeacher.id, otherTeacher.id],
    schoolIds: [school.id],
  })
})

/** Her test için taze bir öğrenci + mentorTeacher'a ait mentörlük kaydı oluşturur. */
async function createMentoredStudent(): Promise<string> {
  const { data: stu, error: stuErr } = await serviceDb
    .from('students')
    .insert({ full_name: 'Silme Testi Öğrenci', student_number: null, class_id: classId, school_id: school.id })
    .select('id').single()
  if (stuErr) throw new Error(`test öğrencisi oluşturulamadı: ${stuErr.message}`)
  const studentId = stu!.id

  const { error: mErr } = await serviceDb
    .from('mentorships')
    .insert({ mentor_id: mentorTeacher.id, student_id: studentId, school_id: school.id })
  if (mErr) throw new Error(`test mentörlük kaydı oluşturulamadı: ${mErr.message}`)

  return studentId
}

describe('MentorRepository.deleteMentorship — gerçek fonksiyon, gerçek DB (RLS aktif)', () => {
  it('mentör kendi mentörlük kaydını siler — kayıt gerçekten gider', async () => {
    const studentId = await createMentoredStudent()
    vi.mocked(createClient).mockResolvedValue(createUserClient(tokenMentor) as never)

    const { error } = await MentorRepository.deleteMentorship(studentId, mentorTeacher.id, school.id)
    expect(error).toBeNull()

    const { data: after } = await serviceDb
      .from('mentorships')
      .select('id')
      .eq('student_id', studentId)
      .eq('mentor_id', mentorTeacher.id)
    expect(after ?? [], 'kayıt gerçekten gitmiş olmalı').toHaveLength(0)
  })

  it('başka öğretmen mentörlük kaydını silmeye çalışır — 0 satır etkilenir, açık hata döner (sessiz başarı DEĞİL)', async () => {
    // otherTeacher, mentorTeacher'ın mentörlük kaydını silmeye çalışıyor.
    // RLS (mentorships_owner_all: mentor_id = auth.uid()) bu satırı otherTeacher'a hiç
    // göstermez → DELETE 0 satır etkiler, supabase-js hata döndürmez (sessiz).
    // MentorRepository.deleteMentorship bunu açık bir hataya çevirmek ZORUNDA —
    // aksi halde çağıran "başarılı silindi" sanır (bu projede canlıda yaşanan hata).
    const studentId = await createMentoredStudent()
    vi.mocked(createClient).mockResolvedValue(createUserClient(tokenOther) as never)

    const { error } = await MentorRepository.deleteMentorship(studentId, mentorTeacher.id, school.id)
    expect(error).toEqual({ message: 'Kayıt bulunamadı veya yetkiniz yok.' })

    const { data: after } = await serviceDb
      .from('mentorships')
      .select('id')
      .eq('student_id', studentId)
      .eq('mentor_id', mentorTeacher.id)
    expect(after ?? [], 'kayıt silinmemiş olmalı').toHaveLength(1)
  })
})

describe('MentorRepository.deleteMentorReport — sessiz silme yasak (gerçek DB, RLS aktif)', () => {
  async function createReport(studentId: string): Promise<string> {
    const { data, error } = await serviceDb
      .from('mentor_reports')
      .insert({
        mentor_id: mentorTeacher.id, student_id: studentId, class_id: classId,
        school_id: school.id, content: 'Silme testi notu', report_date: '2026-09-16',
      })
      .select('id').single()
    if (error) throw new Error(`test notu oluşturulamadı: ${error.message}`)
    return data!.id
  }

  it('mentör kendi notunu siler — not gerçekten gider', async () => {
    const reportId = await createReport(await createMentoredStudent())
    vi.mocked(createClient).mockResolvedValue(createUserClient(tokenMentor) as never)

    const { error } = await MentorRepository.deleteMentorReport(reportId, mentorTeacher.id, school.id)
    expect(error).toBeNull()

    const { data: after } = await serviceDb.from('mentor_reports').select('id').eq('id', reportId)
    expect(after ?? []).toHaveLength(0)
  })

  it('başka öğretmen notu silmeye çalışır — açık hata döner, not kalır', async () => {
    const reportId = await createReport(await createMentoredStudent())
    vi.mocked(createClient).mockResolvedValue(createUserClient(tokenOther) as never)

    const { error } = await MentorRepository.deleteMentorReport(reportId, otherTeacher.id, school.id)
    expect(error).toEqual({ message: 'Kayıt bulunamadı veya yetkiniz yok.' })

    const { data: after } = await serviceDb.from('mentor_reports').select('id').eq('id', reportId)
    expect(after ?? []).toHaveLength(1)
  })
})
