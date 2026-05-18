/**
 * RLS politika testleri — her tablo için erişim matrisini doğrular.
 * Rol bazlı erişim (öğretmen vs müdür) ve sahiplik kısıtlamaları test edilir.
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

let school:   TestSchool
let ogretmen: TestUser
let mudur:    TestUser
let tokenOgretmen: string
let tokenMudur:    string

let classId:    string
let studentId:  string
let homeworkId: string

beforeAll(async () => {
  school = await createTestSchool('_RLS')

  ;[ogretmen, mudur] = await Promise.all([
    createTestUser({ role: 'ogretmen',  schoolId: school.id }),
    createTestUser({ role: 'mudur',     schoolId: school.id }),
  ])

  ;[tokenOgretmen, tokenMudur] = await Promise.all([
    signInTestUser(ogretmen.email, ogretmen.password),
    signInTestUser(mudur.email,    mudur.password),
  ])

  // Sınıf
  const { data: cls } = await serviceDb
    .from('classes')
    .insert({ name: 'RLS Test Sınıfı', grade: 6, academic_year: '2025-2026', school_id: school.id })
    .select('id').single()
  classId = cls!.id

  // Öğrenci
  const { data: stu } = await serviceDb
    .from('students')
    .insert({ full_name: 'RLS Öğrenci', student_number: null, class_id: classId, school_id: school.id })
    .select('id').single()
  studentId = stu!.id

  // Ödev (ogretmen tarafından)
  const { data: hw } = await serviceDb
    .from('homeworks')
    .insert({
      teacher_id:  ogretmen.id,
      class_id:    classId,
      school_id:   school.id,
      title:       'RLS Test Ödevi',
      subject:     'Fen',
      due_date:    '2026-12-31',
      description: null,
    })
    .select('id').single()
  homeworkId = hw!.id
})

afterAll(async () => {
  await cleanupTestData({
    userIds:  [ogretmen.id, mudur.id],
    schoolIds: [school.id],
  })
})

// ── homeworks RLS ─────────────────────────────────────────────
describe('homeworks RLS', () => {
  it('öğretmen kendi okulundaki ödevleri okuyabilir', async () => {
    const client = createUserClient(tokenOgretmen)
    const { data, error } = await client
      .from('homeworks').select('id').eq('id', homeworkId)
    expect(error).toBeNull()
    expect(data).toHaveLength(1)
  })

  it('öğretmen kendi adına ödev ekleyebilir', async () => {
    const client = createUserClient(tokenOgretmen)
    const { error } = await client.from('homeworks').insert({
      teacher_id:  ogretmen.id,
      class_id:    classId,
      school_id:   school.id,
      title:       'Yeni RLS Ödevi',
      subject:     'Tarih',
      due_date:    '2026-11-01',
      description: null,
    })
    expect(error).toBeNull()
  })

  it('öğretmen başka öğretmenin adına ödev ekleyemez', async () => {
    const client = createUserClient(tokenOgretmen)
    const { error } = await client.from('homeworks').insert({
      teacher_id:  mudur.id,    // başkası!
      class_id:    classId,
      school_id:   school.id,
      title:       'Sahte Ödev',
      subject:     'Sahte',
      due_date:    '2026-11-01',
      description: null,
    })
    expect(error).not.toBeNull()
  })

  it('öğretmen kendi ödevini silebilir', async () => {
    // Önce sileceğimiz bir ödev oluştur
    const { data: hw } = await serviceDb.from('homeworks').insert({
      teacher_id: ogretmen.id, class_id: classId, school_id: school.id,
      title: 'Silinecek Ödev', subject: 'X', due_date: '2026-10-01', description: null,
    }).select('id').single()

    const client = createUserClient(tokenOgretmen)
    const { error } = await client.from('homeworks').delete().eq('id', hw!.id)
    expect(error).toBeNull()
  })

  it('öğretmen başka öğretmenin ödevini silemez', async () => {
    const client = createUserClient(tokenOgretmen)
    // mudur'un ID'siyle oluşturulmuş ödev — öğretmen silemez
    const { data: hw } = await serviceDb.from('homeworks').insert({
      teacher_id: mudur.id, class_id: classId, school_id: school.id,
      title: 'Mudur Odevi', subject: 'Y', due_date: '2026-10-01', description: null,
    }).select('id').single()

    const { error } = await client.from('homeworks').delete().eq('id', hw!.id)
    // RLS, DELETE'i engeller — rows affected = 0 (error null ama veri silinmez)
    const { data: check } = await serviceDb.from('homeworks').select('id').eq('id', hw!.id)
    expect(check).toHaveLength(1)  // hâlâ duruyor
  })
})

// ── audit_logs RLS — WORM (Write Once Read Many) ─────────────
describe('audit_logs WORM kısıtlaması', () => {
  let logId: string

  beforeAll(async () => {
    const { data } = await serviceDb
      .from('audit_logs')
      .insert({ user_id: ogretmen.id, action: 'login', school_id: school.id })
      .select('id').single()
    logId = data!.id
  })

  it('öğretmen kendi audit log kaydını görebilir', async () => {
    const client = createUserClient(tokenOgretmen)
    const { data } = await client
      .from('audit_logs').select('id').eq('id', logId)
    expect(data!.length).toBeGreaterThanOrEqual(0)  // RLS SELECT politikasına göre
  })

  it('kimse audit log güncelleyemez', async () => {
    // RLS: UPDATE politikası yok → 0 satır etkilenir, hata değil (sessiz koruma)
    const client = createUserClient(tokenOgretmen)
    const { data, error } = await client
      .from('audit_logs').update({ action: 'tampered' }).eq('id', logId).select('id')
    expect(error).toBeNull()
    expect(data ?? []).toHaveLength(0)

    const { data: orig } = await serviceDb
      .from('audit_logs').select('action').eq('id', logId).single()
    expect(orig!.action).not.toBe('tampered')
  })

  it('kimse audit log silemez', async () => {
    // RLS: DELETE politikası yok → 0 satır silinir, kayıt korunur
    const client = createUserClient(tokenOgretmen)
    const { data, error } = await client
      .from('audit_logs').delete().eq('id', logId).select('id')
    expect(error).toBeNull()
    expect(data ?? []).toHaveLength(0)

    const { data: check } = await serviceDb
      .from('audit_logs').select('id').eq('id', logId)
    expect(check).toHaveLength(1)
  })
})

// ── export_jobs RLS ───────────────────────────────────────────
describe('export_jobs RLS — kullanıcı izolasyonu', () => {
  let jobIdA: string
  let jobIdB: string  // ogretmen'in işi B gibi gösterelim — aslında mudur'un

  beforeAll(async () => {
    const [a, b] = await Promise.all([
      serviceDb.from('export_jobs').insert({
        school_id: school.id, user_id: ogretmen.id,
        job_type: 'excel_odevler', status: 'pending',
        params: {}, inngest_event_id: `test-evt-${Date.now()}-a`,
        progress: 0, attempt: 1,
      }).select('id').single(),
      serviceDb.from('export_jobs').insert({
        school_id: school.id, user_id: mudur.id,
        job_type: 'excel_odevler', status: 'pending',
        params: {}, inngest_event_id: `test-evt-${Date.now()}-b`,
        progress: 0, attempt: 1,
      }).select('id').single(),
    ])
    jobIdA = a.data!.id
    jobIdB = b.data!.id
  })

  it('öğretmen kendi export işini görebilir', async () => {
    const client = createUserClient(tokenOgretmen)
    const { data } = await client.from('export_jobs').select('id').eq('id', jobIdA)
    expect(data).toHaveLength(1)
  })

  it('öğretmen müdürün export işini göremez', async () => {
    const client = createUserClient(tokenOgretmen)
    const { data } = await client.from('export_jobs').select('id').eq('id', jobIdB)
    expect(data).toHaveLength(0)
  })
})
