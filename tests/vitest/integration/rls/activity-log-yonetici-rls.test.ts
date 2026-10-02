/**
 * 2026-09-29: "Öğretmen Aktivitesi" raporu MY'de herkesi 0 / Pasif gösteriyordu — teacher_activity_log'da
 * yalnız "kendi kaydını oku" politikası vardı (baseline'dan beri). Yönetici (müdür/MY) kendi okulunun
 * kayıtlarını okur; öğretmen yalnız kendisininkini; başka okul hiçbir şey. Gerçek JWT'lerle.
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

let okul: TestSchool, digerOkul: TestSchool
let my: TestUser, mudur: TestUser, ogr1: TestUser, ogr2: TestUser, digerMy: TestUser
let myT: string, mudurT: string, ogr1T: string, digerMyT: string

beforeAll(async () => {
  okul = await createTestSchool('_AKTIVITE')
  digerOkul = await createTestSchool('_AKTIVITE2')
  my = await createTestUser({ role: 'mudur_yardimcisi', schoolId: okul.id })
  mudur = await createTestUser({ role: 'mudur', schoolId: okul.id })
  ogr1 = await createTestUser({ role: 'ogretmen', schoolId: okul.id })
  ogr2 = await createTestUser({ role: 'ogretmen', schoolId: okul.id })
  digerMy = await createTestUser({ role: 'mudur_yardimcisi', schoolId: digerOkul.id })
  // sırayla — paralel giriş Supabase auth hız sınırını tetikliyordu (tam pakette)
  myT = await signInTestUser(my.email, my.password)
  mudurT = await signInTestUser(mudur.email, mudur.password)
  ogr1T = await signInTestUser(ogr1.email, ogr1.password)
  digerMyT = await signInTestUser(digerMy.email, digerMy.password)
  const { error } = await serviceDb.from('teacher_activity_log').insert([
    { teacher_id: ogr1.id, school_id: okul.id, action: 'homework_created' },
    { teacher_id: ogr2.id, school_id: okul.id, action: 'homework_created' },
    { teacher_id: ogr2.id, school_id: okul.id, action: 'attendance_taken' },
  ])
  if (error) throw error
}, 120_000) // giriş hız sınırında yeniden deneme payı (signInTestUser)

afterAll(async () => {
  await serviceDb.from('teacher_activity_log').delete().in('school_id', [okul.id, digerOkul.id])
  await cleanupTestData({ userIds: [my.id, mudur.id, ogr1.id, ogr2.id, digerMy.id], schoolIds: [okul.id, digerOkul.id] })
})

const oku = (token: string) => createUserClient(token).from('teacher_activity_log').select('teacher_id, school_id')

describe('teacher_activity_log okuma yetkisi', () => {
  it('müdür yardımcısı okulundaki tüm öğretmenlerin kayıtlarını görür', async () => {
    const { data, error } = await oku(myT)
    expect(error).toBeNull()
    expect(data).toHaveLength(3)
  })

  it('müdür de görür', async () => {
    const { data } = await oku(mudurT)
    expect(data).toHaveLength(3)
  })

  it('öğretmen yalnız kendi kaydını görür (değişmedi)', async () => {
    const { data } = await oku(ogr1T)
    expect((data ?? []).map((r: { teacher_id: string }) => r.teacher_id)).toEqual([ogr1.id])
  })

  it('başka okulun MY\'si bu okulun kayıtlarını görmez', async () => {
    const { data } = await oku(digerMyT)
    expect(data ?? []).toEqual([])
  })
})
