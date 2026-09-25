/**
 * Öğretmen KENDİ oturumuyla ödevini siler ve geri alır (2026-09-25 bulgusu).
 *
 * Canlıda başarılı silmelerin tamamı zümre başkanına aitti: SELECT policy'si silinmiş
 * satırı düz öğretmenden gizlediği için `update(...).select('id')` öğretmende 42501
 * veriyordu, geri alma hiç çalışmıyordu. Silme/geri alma soft_delete_homeworks /
 * restore_homeworks RPC'lerine taşındı; bu test onları gerçek JWT'lerle sınar.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import {
  serviceDb, createUserClient, createTestSchool, createTestUser, signInTestUser, cleanupTestData,
  type TestSchool, type TestUser,
} from '../../setup/db'

let school: TestSchool
let ogretmen: TestUser
let digerOgretmen: TestUser
let token: string
let digerToken: string
let hwId: string

const silinmisMi = async () =>
  (await serviceDb.from('homeworks').select('deleted_at').eq('id', hwId).single()).data!.deleted_at !== null

beforeAll(async () => {
  school = await createTestSchool('_OWNDEL')
  ;[ogretmen, digerOgretmen] = await Promise.all([
    createTestUser({ role: 'ogretmen', schoolId: school.id }),
    createTestUser({ role: 'ogretmen', schoolId: school.id }),
  ])
  ;[token, digerToken] = await Promise.all([
    signInTestUser(ogretmen.email, ogretmen.password),
    signInTestUser(digerOgretmen.email, digerOgretmen.password),
  ])
  const { data: cls } = await serviceDb.from('classes')
    .insert({ name: 'Sil Test', grade: 9, academic_year: '2025-2026', school_id: school.id })
    .select('id').single()
  const { data: hw, error } = await serviceDb.from('homeworks')
    .insert({ teacher_id: ogretmen.id, class_id: cls!.id, school_id: school.id, title: 'Silinecek', subject: 'Matematik', due_date: '2026-12-31' })
    .select('id').single()
  if (error) throw error
  hwId = hw!.id
})

afterAll(async () => {
  await cleanupTestData({ userIds: [ogretmen.id, digerOgretmen.id], schoolIds: [school.id] })
})

describe('ödev silme / geri alma (RPC)', () => {
  it('başka öğretmen silemez — hiçbir satır değişmez', async () => {
    const { data, error } = await createUserClient(digerToken).rpc('soft_delete_homeworks', { p_ids: [hwId] })
    expect(error).toBeNull()
    expect(data).toEqual([])
    expect(await silinmisMi()).toBe(false)
  })

  it('öğretmen kendi ödevini silebilir', async () => {
    const { data, error } = await createUserClient(token).rpc('soft_delete_homeworks', { p_ids: [hwId] })
    expect(error).toBeNull()
    expect(data).toEqual([hwId])
    expect(await silinmisMi()).toBe(true)
  })

  it('silinmiş ödev öğretmenin listesinde görünmez (SELECT policy gevşemedi)', async () => {
    const { data } = await createUserClient(token).from('homeworks').select('id').eq('id', hwId)
    expect(data).toEqual([])
  })

  it('başka öğretmen geri alamaz', async () => {
    const { data } = await createUserClient(digerToken).rpc('restore_homeworks', { p_ids: [hwId] })
    expect(data).toEqual([])
    expect(await silinmisMi()).toBe(true)
  })

  it('öğretmen kendi ödevini geri alabilir', async () => {
    const { data, error } = await createUserClient(token).rpc('restore_homeworks', { p_ids: [hwId] })
    expect(error).toBeNull()
    expect(data).toEqual([hwId])
    expect(await silinmisMi()).toBe(false)
  })

  it('anonim kullanıcı RPC çalıştıramaz', async () => {
    const { createClient } = await import('@supabase/supabase-js')
    const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!)
    const { error } = await anon.rpc('soft_delete_homeworks', { p_ids: [hwId] })
    expect(error).not.toBeNull()
    expect(await silinmisMi()).toBe(false)
  })
})
