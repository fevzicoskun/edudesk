/**
 * 2026-10-10 canlıya geçiş öncesi tarama: tarayıcıdan PostgREST'e doğrudan istekle yapılabilenler
 * (kendine müdür rolü, öğrenciyi kalıcı silme, okul abonelik alanı, kendini sınıfa atama, başkasının
 * veli görüşme kaydı). Migration 20261010160000_guvenlik_ve_hiz_rls. Gerçek JWT'lerle.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import {
  serviceDb, createUserClient, createTestSchool, createTestUser, signInTestUser, cleanupTestData,
  type TestSchool, type TestUser,
} from '../../setup/db'

let okul: TestSchool
let ogr: TestUser, diger: TestUser, zb: TestUser
let ogrT: string, digerT: string, zbT: string
let benimSinif: string, digerSinif: string, benimOgrenci: string, digerOgrenci: string

beforeAll(async () => {
  okul = await createTestSchool('_GUVENLIK')
  ;[ogr, diger, zb] = await Promise.all([
    createTestUser({ role: 'ogretmen', schoolId: okul.id }),
    createTestUser({ role: 'ogretmen', schoolId: okul.id }),
    createTestUser({ role: 'zumre_baskani', schoolId: okul.id }),
  ])
  ;[ogrT, digerT, zbT] = await Promise.all([
    signInTestUser(ogr.email, ogr.password), signInTestUser(diger.email, diger.password), signInTestUser(zb.email, zb.password),
  ])
  const sinif = async (ad: string) => (await serviceDb.from('classes')
    .insert({ name: ad, grade: 9, academic_year: '2026-2027', school_id: okul.id }).select('id').single()).data!.id
  ;[benimSinif, digerSinif] = await Promise.all([sinif('G-1'), sinif('G-2')])
  const ogrenci = async (cid: string) => (await serviceDb.from('students')
    .insert({ full_name: 'Öğr', class_id: cid, school_id: okul.id }).select('id').single()).data!.id
  ;[benimOgrenci, digerOgrenci] = await Promise.all([ogrenci(benimSinif), ogrenci(digerSinif)])
  await serviceDb.from('teacher_classes').insert({ teacher_id: ogr.id, class_id: benimSinif })
})

afterAll(async () => {
  await cleanupTestData({ userIds: [ogr.id, diger.id, zb.id], schoolIds: [okul.id] })
})

describe('RLS — doğrudan API ile yetki yükseltme ve veri kaybı kapalı', () => {
  it('öğretmen kendine müdür rolü ekleyemez', async () => {
    const { data: rol } = await serviceDb.from('roles').select('id').eq('name', 'mudur').single()
    const { error } = await createUserClient(ogrT).from('user_roles')
      .insert({ user_id: ogr.id, role_id: rol!.id, school_id: okul.id })
    expect(error?.code).toBe('42501')
  })

  it('öğretmen öğrenciyi kalıcı silemez', async () => {
    const { data } = await createUserClient(ogrT).from('students').delete().eq('id', benimOgrenci).select('id')
    expect(data ?? []).toEqual([])
    expect((await serviceDb.from('students').select('id').eq('id', benimOgrenci)).data).toHaveLength(1)
  })

  it('öğretmen yalnız kendi sınıfının öğrencisini günceller (veli bilgisi)', async () => {
    const db = createUserClient(ogrT)
    const kendi = await db.from('students').update({ veli_telefon: '05550000000' }).eq('id', benimOgrenci).select('id')
    expect(kendi.data).toHaveLength(1)
    const baska = await db.from('students').update({ veli_telefon: '05559999999' }).eq('id', digerOgrenci).select('id')
    expect(baska.data ?? []).toEqual([])
  })

  it('öğretmen kendini başka sınıfa atayamaz', async () => {
    const { error } = await createUserClient(ogrT).from('teacher_classes').insert({ teacher_id: ogr.id, class_id: digerSinif })
    expect(error?.code).toBe('42501')
  })

  it('zümre başkanı okulun abonelik alanlarını değiştiremez', async () => {
    const { data } = await createUserClient(zbT).from('schools').update({ access_until: '2100-01-01' }).eq('id', okul.id).select('id')
    expect(data ?? []).toEqual([])
  })

  it('öğretmen başkasının veli görüşme kaydını silemez', async () => {
    const { data: kayit } = await serviceDb.from('parent_contact_logs').insert({
      school_id: okul.id, student_id: benimOgrenci, teacher_id: ogr.id, note: 'not', contact_method: 'telefon', contacted_at: new Date().toISOString(),
    }).select('id').single()
    const { data } = await createUserClient(digerT).from('parent_contact_logs').delete().eq('id', kayit!.id).select('id')
    expect(data ?? []).toEqual([])
    const sahibi = await createUserClient(ogrT).from('parent_contact_logs').delete().eq('id', kayit!.id).select('id')
    expect(sahibi.data).toHaveLength(1)
  })
})
