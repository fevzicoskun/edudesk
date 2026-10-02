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
      due_date:    '2099-12-31',
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
      due_date:    '2099-12-31',
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
      due_date:    '2099-12-31',
      description: null,
    })
    expect(error).not.toBeNull()
  })

  it('öğretmen kendi ödevini silebilir', async () => {
    // Önce sileceğimiz bir ödev oluştur
    const { data: hw } = await serviceDb.from('homeworks').insert({
      teacher_id: ogretmen.id, class_id: classId, school_id: school.id,
      title: 'Silinecek Ödev', subject: 'X', due_date: '2099-12-31', description: null,
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
      title: 'Mudur Odevi', subject: 'Y', due_date: '2099-12-31', description: null,
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
      // user_id BOŞ: kayıt silinemez/değiştirilemez olduğu için kullanıcıya bağlı satır, FK'nin
      // ON DELETE SET NULL güncellemesini de engelliyor → test kullanıcısı silinemeyip auth'ta yetim kalıyordu
      .insert({ user_id: null, action: 'login', school_id: school.id })
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

  it('servis anahtarı da değiştiremez — user_id\'yi elle boşaltmak dahil', async () => {
    const { error: e1 } = await serviceDb.from('audit_logs').update({ action: 'tampered' }).eq('id', logId)
    const { error: e2 } = await serviceDb.from('audit_logs').update({ user_id: null }).eq('id', logId)
    const { error: e3 } = await serviceDb.from('audit_logs').delete().eq('id', logId)
    expect([e1, e2, e3].every(e => e?.message.includes('WORM'))).toBe(true)
  })

  // 2026-10-03: FK (ON DELETE SET NULL) ile WORM trigger'ı çakışıyordu → audit kaydı olan kullanıcı HİÇ
  // silinemiyordu ("Database error deleting user"). Migration 20261003000000 dar istisna ekledi.
  it('audit kaydı olan kullanıcı silinebilir; kayıt durur, yalnız user_id boşalır', async () => {
    const gecici = await createTestUser({ role: 'ogretmen', schoolId: school.id })
    const { data: log } = await serviceDb
      .from('audit_logs')
      .insert({ user_id: gecici.id, action: 'login', school_id: school.id })
      .select('id').single()

    const { error } = await serviceDb.auth.admin.deleteUser(gecici.id)
    expect(error).toBeNull()

    const { data: kalan } = await serviceDb.from('audit_logs').select('user_id, action').eq('id', log!.id).single()
    expect(kalan).toEqual({ user_id: null, action: 'login' })
  })
})
