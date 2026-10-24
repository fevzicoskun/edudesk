/**
 * Deneme sonuçları RLS'i (spec 2026-10-22 veli toplantısı kâğıdı) — gerçek kullanıcı JWT'siyle.
 * Yazma/okuma: takip kapısındaki güncel mentör (mentor_takip_erisimi); müdür/MY yalnız okur;
 * sınav oluşturma kapı (mentor_takip_acik) ister; okul+tür+seviye+tarih tekil.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import {
  serviceDb, createUserClient, createTestSchool, createTestUser, signInTestUser, cleanupTestData,
  type TestSchool, type TestUser,
} from '../../setup/db'

let okul: TestSchool
let mentor: TestUser, baska: TestUser, my: TestUser
let tMentor: string, tBaska: string, tMy: string
let ogrA: string, ogrB: string, sinavId: string

const sonuc = (studentId: string) => ({
  sinav_id: sinavId, student_id: studentId, school_id: okul.id,
  dersler: [{ kod: 'TAR', ss: 26, d: 21, y: 5, n: 19.75 }], toplam_net: 19.75, puan: 448.3,
})

beforeAll(async () => {
  okul = await createTestSchool('_DENEME_RLS')
  ;[mentor, baska, my] = await Promise.all([
    createTestUser({ role: 'ogretmen', schoolId: okul.id }),
    createTestUser({ role: 'ogretmen', schoolId: okul.id }),
    createTestUser({ role: 'mudur_yardimcisi', schoolId: okul.id }),
  ])
  ;[tMentor, tBaska, tMy] = await Promise.all([mentor, baska, my].map(u => signInTestUser(u.email, u.password)))
  const { data: cls, error: ce } = await serviceDb.from('classes')
    .insert({ name: '9-Z', grade: 9, academic_year: '2026-2027', school_id: okul.id }).select('id').single()
  if (ce) throw new Error(ce.message)
  const { data: ogr, error: oe } = await serviceDb.from('students')
    .insert([{ full_name: 'Deneme A', class_id: cls!.id, school_id: okul.id }, { full_name: 'Deneme B', class_id: cls!.id, school_id: okul.id }])
    .select('id')
  if (oe) throw new Error(oe.message)
  ;[ogrA, ogrB] = ogr!.map(o => o.id)
  const kurulum = await Promise.all([
    serviceDb.from('mentorships').insert({ mentor_id: mentor.id, student_id: ogrA, school_id: okul.id, assigned_by: mentor.id }),
    serviceDb.from('mentor_takip_kullanicilari').insert({ user_id: mentor.id, school_id: okul.id }),
  ])
  for (const k of kurulum) if (k.error) throw new Error(k.error.message)
  const s = await createUserClient(tMentor).from('deneme_sinavlari')
    .insert({ school_id: okul.id, tur: 'TCD', seviye: 9, tarih: '2026-10-20', created_by: mentor.id }).select('id').single()
  if (s.error) throw new Error(s.error.message)
  sinavId = s.data!.id
})

afterAll(async () => {
  await cleanupTestData({ userIds: [mentor.id, baska.id, my.id], schoolIds: [okul.id] })
})

describe('deneme sonuçları — RLS', () => {
  it('mentör kendi öğrencisine sonuç yazar ve okur', async () => {
    const db = createUserClient(tMentor)
    const ins = await db.from('deneme_sonuclari').insert(sonuc(ogrA))
    expect(ins.error).toBeNull()
    const { data } = await db.from('deneme_sonuclari').select('student_id').eq('sinav_id', sinavId)
    expect(data).toHaveLength(1)
  })

  it('mentör mentörü olmadığı öğrenciye yazamaz', async () => {
    const ins = await createUserClient(tMentor).from('deneme_sonuclari').insert(sonuc(ogrB))
    expect(ins.error).not.toBeNull()
  })

  it('takip listesinde olmayan öğretmen sınav oluşturamaz', async () => {
    const ins = await createUserClient(tBaska).from('deneme_sinavlari')
      .insert({ school_id: okul.id, tur: 'TM', seviye: 9, tarih: '2026-10-21', created_by: baska.id })
    expect(ins.error).not.toBeNull()
  })

  it('MY okur ama yazamaz', async () => {
    const db = createUserClient(tMy)
    const { data } = await db.from('deneme_sonuclari').select('student_id').eq('student_id', ogrA)
    expect(data).toHaveLength(1)
    const ins = await db.from('deneme_sonuclari').insert(sonuc(ogrB))
    expect(ins.error).not.toBeNull()
  })

  it('takipte olmayan öğretmen sonuç göremez', async () => {
    const { data } = await createUserClient(tBaska).from('deneme_sonuclari').select('student_id').eq('student_id', ogrA)
    expect(data ?? []).toHaveLength(0)
  })

  it('aynı okul+tür+seviye+tarih ikinci kez eklenemez', async () => {
    const ins = await createUserClient(tMentor).from('deneme_sinavlari')
      .insert({ school_id: okul.id, tur: 'TCD', seviye: 9, tarih: '2026-10-20', created_by: mentor.id })
    expect(ins.error?.code).toBe('23505')
  })
})
