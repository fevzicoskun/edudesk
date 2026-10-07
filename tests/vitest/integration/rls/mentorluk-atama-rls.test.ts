/**
 * Öğrenci bazlı mentörlük RLS'i — gerçek kullanıcı JWT'siyle (createUserClient), servis anahtarıyla DEĞİL.
 * Kurallar (spec 2026-10-07): tek mentör (unique student_id); öğretmen yalnız kendine ve assigned_by=kendisi
 * ekler; idare atamasını öğretmen silemez; MY okul içinde atar/değiştirir; başka okula yazamaz;
 * öğretmen başkasının satırını göremez; ogrenci_mentor_adlari yalnız kendi okulunu döner.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import {
  serviceDb, createUserClient, createTestSchool, createTestUser, signInTestUser, cleanupTestData,
  type TestSchool, type TestUser,
} from '../../setup/db'

let okul: TestSchool, digerOkul: TestSchool
let ogrA: TestUser, ogrB: TestUser, my: TestUser, digerMy: TestUser
let tA: string, tB: string, tMy: string, tDigerMy: string
let classId: string

async function ogrenci(ad: string): Promise<string> {
  const { data, error } = await serviceDb.from('students')
    .insert({ full_name: ad, student_number: null, class_id: classId, school_id: okul.id })
    .select('id').single()
  if (error) throw new Error(error.message)
  return data!.id
}

beforeAll(async () => {
  ;[okul, digerOkul] = await Promise.all([createTestSchool('_MENTOR_ATAMA'), createTestSchool('_MENTOR_ATAMA_2')])
  ;[ogrA, ogrB, my, digerMy] = await Promise.all([
    createTestUser({ role: 'ogretmen', schoolId: okul.id }),
    createTestUser({ role: 'ogretmen', schoolId: okul.id }),
    createTestUser({ role: 'mudur_yardimcisi', schoolId: okul.id }),
    createTestUser({ role: 'mudur_yardimcisi', schoolId: digerOkul.id }),
  ])
  ;[tA, tB, tMy, tDigerMy] = await Promise.all([ogrA, ogrB, my, digerMy].map(u => signInTestUser(u.email, u.password)))
  const { data: cls } = await serviceDb.from('classes')
    .insert({ name: 'Mentör Atama Test', grade: 10, academic_year: '2025-2026', school_id: okul.id })
    .select('id').single()
  classId = cls!.id
})

afterAll(async () => {
  await cleanupTestData({ userIds: [ogrA.id, ogrB.id, my.id, digerMy.id], schoolIds: [okul.id, digerOkul.id] })
})

describe('mentorships — öğrenci bazlı RLS', () => {
  it('öğretmen kendine ekler; ikinci öğretmen aynı öğrenciyi ekleyemez (23505)', async () => {
    const sid = await ogrenci('Tek Mentör')
    const a = await createUserClient(tA).from('mentorships')
      .insert({ mentor_id: ogrA.id, student_id: sid, school_id: okul.id, assigned_by: ogrA.id })
    expect(a.error).toBeNull()
    const b = await createUserClient(tB).from('mentorships')
      .insert({ mentor_id: ogrB.id, student_id: sid, school_id: okul.id, assigned_by: ogrB.id })
    expect(b.error?.code).toBe('23505')
  })

  it('öğretmen başkası adına ya da assigned_by=başkası ile ekleyemez', async () => {
    const sid = await ogrenci('Sahte Atama')
    const r1 = await createUserClient(tA).from('mentorships')
      .insert({ mentor_id: ogrB.id, student_id: sid, school_id: okul.id, assigned_by: ogrA.id })
    expect(r1.error).not.toBeNull()
    const r2 = await createUserClient(tA).from('mentorships')
      .insert({ mentor_id: ogrA.id, student_id: sid, school_id: okul.id, assigned_by: my.id })
    expect(r2.error).not.toBeNull()
  })

  it('MY atar; öğretmen idare atamasını silemez, MY silebilir', async () => {
    const sid = await ogrenci('İdare Ataması')
    const ins = await createUserClient(tMy).from('mentorships')
      .insert({ mentor_id: ogrA.id, student_id: sid, school_id: okul.id, assigned_by: my.id })
    expect(ins.error).toBeNull()
    const silA = await createUserClient(tA).from('mentorships').delete().eq('student_id', sid).select('id')
    expect(silA.data ?? []).toHaveLength(0)
    const silMy = await createUserClient(tMy).from('mentorships').delete().eq('student_id', sid).select('id')
    expect(silMy.data).toHaveLength(1)
  })

  it('MY upsert ile mentörü değiştirir', async () => {
    const sid = await ogrenci('Mentör Değişimi')
    await createUserClient(tA).from('mentorships')
      .insert({ mentor_id: ogrA.id, student_id: sid, school_id: okul.id, assigned_by: ogrA.id })
    const up = await createUserClient(tMy).from('mentorships')
      .upsert({ mentor_id: ogrB.id, student_id: sid, school_id: okul.id, assigned_by: my.id }, { onConflict: 'student_id' })
      .select('mentor_id')
    expect(up.error).toBeNull()
    expect(up.data?.[0].mentor_id).toBe(ogrB.id)
  })

  it('öğretmen başkasının satırını görmez; MY okuldakilerin hepsini görür', async () => {
    const sid = await ogrenci('Görünürlük')
    await createUserClient(tB).from('mentorships')
      .insert({ mentor_id: ogrB.id, student_id: sid, school_id: okul.id, assigned_by: ogrB.id })
    const a = await createUserClient(tA).from('mentorships').select('id').eq('student_id', sid)
    expect(a.data).toHaveLength(0)
    const m = await createUserClient(tMy).from('mentorships').select('id').eq('student_id', sid)
    expect(m.data).toHaveLength(1)
  })

  it('başka okulun MY\'si bu okula atama yapamaz', async () => {
    const sid = await ogrenci('Okullar Arası')
    const r = await createUserClient(tDigerMy).from('mentorships')
      .insert({ mentor_id: ogrA.id, student_id: sid, school_id: okul.id, assigned_by: digerMy.id })
    expect(r.error).not.toBeNull()
  })

  it('ogrenci_mentor_adlari: öğretmen kendi okulundaki tüm atamaların yalnız adını görür', async () => {
    const sid = await ogrenci('Ad RPC')
    await createUserClient(tB).from('mentorships')
      .insert({ mentor_id: ogrB.id, student_id: sid, school_id: okul.id, assigned_by: ogrB.id })
    const { data, error } = await createUserClient(tA).rpc('ogrenci_mentor_adlari')
    expect(error).toBeNull()
    const satir = (data ?? []).find((r: { student_id: string }) => r.student_id === sid)
    expect(satir).toMatchObject({ mentor_id: ogrB.id })
    expect(Object.keys(satir!).sort()).toEqual(['mentor_adi', 'mentor_id', 'student_id'])
    const diger = await createUserClient(tDigerMy).rpc('ogrenci_mentor_adlari')
    expect((diger.data ?? []).some((r: { student_id: string }) => r.student_id === sid)).toBe(false)
  })
})
