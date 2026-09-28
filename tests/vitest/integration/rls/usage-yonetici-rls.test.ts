/**
 * 2026-09-29: MY/müdür ana sayfası öğretmen aktifliğini usage_daily'den okur (user_sessions 2026-06-02'den
 * beri beslenmiyordu → herkes "Pasif"). okul_son_kullanim() SECURITY INVOKER — RLS'e tabidir:
 * yalnız müdür/MY, yalnız KENDİ okulunun satırlarını görür. Gerçek JWT'lerle sınanır (servis anahtarı RLS'i atlar).
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
let my: TestUser, mudur: TestUser, ogretmen: TestUser, digerMy: TestUser
let myToken: string, mudurToken: string, ogretmenToken: string, digerMyToken: string

const gun = (onceGun: number) =>
  new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Istanbul' }).format(new Date(Date.now() - onceGun * 864e5))

beforeAll(async () => {
  okul = await createTestSchool('_KULLANIM')
  digerOkul = await createTestSchool('_KULLANIM2')
  my = await createTestUser({ role: 'mudur_yardimcisi', schoolId: okul.id })
  mudur = await createTestUser({ role: 'mudur', schoolId: okul.id })
  ogretmen = await createTestUser({ role: 'ogretmen', schoolId: okul.id })
  digerMy = await createTestUser({ role: 'mudur_yardimcisi', schoolId: digerOkul.id })
  ;[myToken, mudurToken, ogretmenToken, digerMyToken] = await Promise.all([
    signInTestUser(my.email, my.password), signInTestUser(mudur.email, mudur.password),
    signInTestUser(ogretmen.email, ogretmen.password), signInTestUser(digerMy.email, digerMy.password),
  ])
  // Öğretmen: 3 farklı günde kullanım (biri 20 gün önce), bir günde iki ekran
  const { error } = await serviceDb.from('usage_daily').insert([
    { day: gun(1), school_id: okul.id, user_id: ogretmen.id, role: 'ogretmen', feature: 'odevler', count: 3 },
    { day: gun(1), school_id: okul.id, user_id: ogretmen.id, role: 'ogretmen', feature: 'siniflar', count: 1 },
    { day: gun(5), school_id: okul.id, user_id: ogretmen.id, role: 'ogretmen', feature: 'odevler', count: 2 },
    { day: gun(20), school_id: okul.id, user_id: ogretmen.id, role: 'ogretmen', feature: 'odevler', count: 1 },
    { day: gun(2), school_id: digerOkul.id, user_id: digerMy.id, role: 'mudur_yardimcisi', feature: 'anasayfa', count: 1 },
  ])
  if (error) throw error
})

afterAll(async () => {
  await serviceDb.from('usage_daily').delete().in('school_id', [okul.id, digerOkul.id])
  await cleanupTestData({ userIds: [my.id, mudur.id, ogretmen.id, digerMy.id], schoolIds: [okul.id, digerOkul.id] })
})

describe('okul_son_kullanim() — yönetici kendi okulunun öğretmen kullanımını görür', () => {
  it('müdür yardımcısı: öğretmenin son kullanım günü ve kullanılan gün sayısı', async () => {
    const { data, error } = await createUserClient(myToken).rpc('okul_son_kullanim', { p_since: gun(30) })
    expect(error).toBeNull()
    expect(data).toEqual([{ user_id: ogretmen.id, son_gun: gun(1), gun_sayisi: 3 }])
  })

  it('müdür de görür', async () => {
    const { data } = await createUserClient(mudurToken).rpc('okul_son_kullanim', { p_since: gun(30) })
    expect(data?.map((r: { user_id: string }) => r.user_id)).toEqual([ogretmen.id])
  })

  it('p_since penceresi uygulanır (20 gün önceki kullanım 14 günlük pencereye girmez)', async () => {
    const { data } = await createUserClient(myToken).rpc('okul_son_kullanim', { p_since: gun(14) })
    expect(data).toEqual([{ user_id: ogretmen.id, son_gun: gun(1), gun_sayisi: 2 }])
  })

  it('öğretmen hiçbir satır görmez (kendi kullanımı dahil)', async () => {
    const { data, error } = await createUserClient(ogretmenToken).rpc('okul_son_kullanim', { p_since: gun(30) })
    expect(error).toBeNull()
    expect(data ?? []).toEqual([])
  })

  it('başka okulun MY\'si bu okulun verisini görmez — yalnız kendi okulu', async () => {
    const { data } = await createUserClient(digerMyToken).rpc('okul_son_kullanim', { p_since: gun(30) })
    expect(data).toEqual([{ user_id: digerMy.id, son_gun: gun(2), gun_sayisi: 1 }])
  })

  it('doğrudan tablo okumasında da okul sınırı geçerli (RLS)', async () => {
    const { data } = await createUserClient(digerMyToken).from('usage_daily').select('school_id')
    expect(new Set((data ?? []).map(r => r.school_id))).toEqual(new Set([digerOkul.id]))
    const ogr = await createUserClient(ogretmenToken).from('usage_daily').select('user_id')
    expect(ogr.data ?? []).toEqual([])
  })
})
