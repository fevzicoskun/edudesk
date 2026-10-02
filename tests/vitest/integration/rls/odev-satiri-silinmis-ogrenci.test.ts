/**
 * 2026-10-03: ödev açılınca on_homework_created trigger'ı sınıftaki HER öğrenciye submission satırı açıyordu —
 * silinmiş (deleted_at dolu) öğrenciye de. Canlıda 3 silinmiş öğrenciye sonradan verilen 5 ödevde 15 satır vardı.
 * Yalnız servis anahtarı kullanır (giriş yok → auth hız sınırına takılmaz).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { serviceDb, createTestSchool, createTestUser, cleanupTestData, type TestSchool, type TestUser } from '../../setup/db'

let okul: TestSchool, ogretmen: TestUser
let aktifId: string, silinmisId: string, odevId: string

beforeAll(async () => {
  okul = await createTestSchool('_SILOGR')
  ogretmen = await createTestUser({ role: 'ogretmen', schoolId: okul.id })
  const { data: sinif, error: e1 } = await serviceDb.from('classes')
    .insert({ name: 'Sil Test', grade: 9, academic_year: '2099-2100', school_id: okul.id }).select('id').single()
  if (e1) throw e1
  const { data: ogr, error: e2 } = await serviceDb.from('students').insert([
    { full_name: 'Aktif Öğrenci', class_id: sinif.id, school_id: okul.id },
    { full_name: 'Silinmiş Öğrenci', class_id: sinif.id, school_id: okul.id, deleted_at: new Date().toISOString() },
  ]).select('id, full_name')
  if (e2) throw e2
  aktifId = ogr.find(o => o.full_name === 'Aktif Öğrenci')!.id
  silinmisId = ogr.find(o => o.full_name === 'Silinmiş Öğrenci')!.id
  const { data: hw, error: e3 } = await serviceDb.from('homeworks').insert({
    teacher_id: ogretmen.id, class_id: sinif.id, school_id: okul.id, title: 'Trigger Testi', subject: 'Mat', due_date: '2099-12-31',
  }).select('id').single()
  if (e3) throw e3
  odevId = hw.id
})

afterAll(async () => {
  await cleanupTestData({ userIds: [ogretmen.id], schoolIds: [okul.id], homeworkIds: [odevId] })
})

describe('ödev açılınca submission satırları', () => {
  it('aktif öğrenciye satır açılır, silinmiş öğrenciye açılmaz', async () => {
    const { data, error } = await serviceDb.from('homework_submissions').select('student_id').eq('homework_id', odevId)
    expect(error).toBeNull()
    expect((data ?? []).map(r => r.student_id)).toEqual([aktifId])
    expect(silinmisId).toBeTruthy()
  })
})
