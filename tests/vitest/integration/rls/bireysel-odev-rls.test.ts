/**
 * Bireysel ödev RLS'i (spec 2026-10-24) — gerçek kullanıcı JWT'siyle.
 * Öğretmen yalnız KENDİ verdiklerini görür/ekler/düzenler/siler; başka öğretmen göremez;
 * başka okulun öğrencisine ya da başkası adına kayıt açılamaz.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import {
  serviceDb, createUserClient, createTestSchool, createTestUser, signInTestUser, cleanupTestData,
  type TestSchool, type TestUser,
} from '../../setup/db'

let okul: TestSchool, diger: TestSchool
let a: TestUser, b: TestUser, yabanci: TestUser
let tA: string, tB: string
let ogr: string, digerOgr: string

async function ogrenci(schoolId: string, ad: string): Promise<string> {
  const { data: cls, error: ce } = await serviceDb.from('classes')
    .insert({ name: '9-Y', grade: 9, academic_year: '2026-2027', school_id: schoolId }).select('id').single()
  if (ce) throw new Error(ce.message)
  const { data, error } = await serviceDb.from('students').insert({ full_name: ad, class_id: cls!.id, school_id: schoolId }).select('id').single()
  if (error) throw new Error(error.message)
  return data!.id
}
const odev = (ogretmen: string, ogrenciId = ogr, schoolId = okul.id) =>
  ({ school_id: schoolId, ogrenci_id: ogrenciId, ogretmen_id: ogretmen, aciklama: 'Türev testi, s. 45–52', teslim_tarihi: '2026-10-30' })

beforeAll(async () => {
  ;[okul, diger] = await Promise.all([createTestSchool('_BIREYSEL'), createTestSchool('_BIREYSEL_2')])
  ;[a, b, yabanci] = await Promise.all([
    createTestUser({ role: 'ogretmen', schoolId: okul.id }),
    createTestUser({ role: 'ogretmen', schoolId: okul.id }),
    createTestUser({ role: 'ogretmen', schoolId: diger.id }),
  ])
  ;[tA, tB] = await Promise.all([a, b].map(u => signInTestUser(u.email, u.password)))
  ;[ogr, digerOgr] = await Promise.all([ogrenci(okul.id, 'Bireysel A'), ogrenci(diger.id, 'Bireysel X')])
})

afterAll(async () => {
  await cleanupTestData({ userIds: [a.id, b.id, yabanci.id], schoolIds: [okul.id, diger.id] })
})

describe('bireysel_odevler — RLS', () => {
  let id = ''
  it('öğretmen kendi öğrencisine ekler ve okur', async () => {
    const db = createUserClient(tA)
    const ins = await db.from('bireysel_odevler').insert(odev(a.id)).select('id').single()
    expect(ins.error).toBeNull()
    id = ins.data!.id
    const { data } = await db.from('bireysel_odevler').select('id, yapildi').eq('id', id)
    expect(data).toEqual([{ id, yapildi: false }])
  })

  it('öğretmen kendi kaydını yapıldı işaretler ve geri alır', async () => {
    const db = createUserClient(tA)
    const up = await db.from('bireysel_odevler').update({ yapildi: true, yapildi_tarihi: new Date().toISOString() }).eq('id', id).select('yapildi')
    expect(up.data).toEqual([{ yapildi: true }])
    const geri = await db.from('bireysel_odevler').update({ yapildi: false, yapildi_tarihi: null }).eq('id', id).select('yapildi')
    expect(geri.data).toEqual([{ yapildi: false }])
  })

  it('başka öğretmen göremez, düzenleyemez, silemez', async () => {
    const db = createUserClient(tB)
    expect((await db.from('bireysel_odevler').select('id').eq('id', id)).data ?? []).toHaveLength(0)
    expect((await db.from('bireysel_odevler').update({ aciklama: 'değişti' }).eq('id', id).select('id')).data ?? []).toHaveLength(0)
    expect((await db.from('bireysel_odevler').delete().eq('id', id).select('id')).data ?? []).toHaveLength(0)
    const { data } = await serviceDb.from('bireysel_odevler').select('aciklama').eq('id', id).single()
    expect(data!.aciklama).toBe('Türev testi, s. 45–52')
  })

  it('başkası adına ya da başka okulun öğrencisine eklenemez', async () => {
    const db = createUserClient(tA)
    expect((await db.from('bireysel_odevler').insert(odev(b.id))).error).not.toBeNull()
    expect((await db.from('bireysel_odevler').insert(odev(a.id, digerOgr))).error).not.toBeNull()
    expect((await db.from('bireysel_odevler').insert(odev(a.id, digerOgr, diger.id))).error).not.toBeNull()
  })

  it('boş açıklama reddedilir', async () => {
    const ins = await createUserClient(tA).from('bireysel_odevler').insert({ ...odev(a.id), aciklama: '   ' })
    expect(ins.error).not.toBeNull()
  })

  it('öğretmen kendi kaydını siler', async () => {
    const sil = await createUserClient(tA).from('bireysel_odevler').delete().eq('id', id).select('id')
    expect(sil.data).toHaveLength(1)
  })
})
