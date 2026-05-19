/**
 * Aktif RLS bypass saldırı simülasyonları.
 *
 * Bu dosyadaki her test, gerçek bir saldırı vektörünü simüle eder ve
 * RLS politikasının bunu engellediğini doğrular. Test başarısız olursa
 * güvenlik açığı var demektir.
 *
 * Test kategorileri:
 *   1. school_id spoofing — INSERT'te yanlış school_id seti
 *   2. teacher_id forgery — başka öğretmen adına veri yazma
 *   3. ID-bazlı doğrudan erişim — UUID'yi bilen saldırgan
 *   4. Profile manipulation — rol/okul yükseltme girişimi
 *   5. NULL injection — school_id = NULL ile policy bypass
 *   6. Mentor sınırı aşma — atanmamış sınıfa rapor
 *   7. Horizontal privilege escalation — aynı okul içi veri çalma
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import {
  serviceDb,
  createUserClient,
  createAnonClient,
  createTestSchool,
  createTestUser,
  signInTestUser,
  cleanupTestData,
  type TestSchool,
  type TestUser,
} from '../../setup/db'

// ─── Test fixture ─────────────────────────────────────────────────────────────

let schoolA: TestSchool
let schoolB: TestSchool
let teacherA: TestUser
let teacherA2: TestUser  // aynı okul, farklı öğretmen
let teacherB: TestUser

let tokenA:  string
let tokenA2: string
let tokenB:  string

let classA_id:    string
let studentA_id:  string
let homeworkA_id: string

beforeAll(async () => {
  ;[schoolA, schoolB] = await Promise.all([
    createTestSchool('_ATK_A'),
    createTestSchool('_ATK_B'),
  ])

  ;[teacherA, teacherA2, teacherB] = await Promise.all([
    createTestUser({ role: 'ogretmen', schoolId: schoolA.id }),
    createTestUser({ role: 'ogretmen', schoolId: schoolA.id }),
    createTestUser({ role: 'ogretmen', schoolId: schoolB.id }),
  ])

  ;[tokenA, tokenA2, tokenB] = await Promise.all([
    signInTestUser(teacherA.email, teacherA.password),
    signInTestUser(teacherA2.email, teacherA2.password),
    signInTestUser(teacherB.email, teacherB.password),
  ])

  const { data: cls } = await serviceDb
    .from('classes')
    .insert({ name: 'Attack Test Class', grade: 7, academic_year: '2025-2026', school_id: schoolA.id })
    .select('id').single()
  classA_id = cls!.id

  const { data: stu } = await serviceDb
    .from('students')
    .insert({ full_name: 'Attack Target Student', student_number: null, class_id: classA_id, school_id: schoolA.id })
    .select('id').single()
  studentA_id = stu!.id

  const { data: hw } = await serviceDb
    .from('homeworks')
    .insert({
      teacher_id: teacherA.id, class_id: classA_id, school_id: schoolA.id,
      title: 'Attack Target Homework', subject: 'Kimya', due_date: '2026-12-31', description: null,
    })
    .select('id').single()
  homeworkA_id = hw!.id
})

afterAll(async () => {
  await cleanupTestData({
    userIds:   [teacherA.id, teacherA2.id, teacherB.id],
    schoolIds: [schoolA.id, schoolB.id],
  })
})

// ─── 1. school_id spoofing (INSERT) ──────────────────────────────────────────
describe('Saldırı 1: school_id spoofing — INSERT', () => {
  /**
   * Vektör: Okul B öğretmeni, INSERT isteğinde school_id = schoolA.id yazarak
   * Okul A'ya veri eklemeye çalışır.
   * Korunma: RLS WITH CHECK (school_id = current_school_id())
   *           current_school_id() → profiles tablosundan gerçek okul döner
   */

  it('okul B öğretmeni okul A school_id ile homework ekleyemez', async () => {
    const client = createUserClient(tokenB)
    const { error } = await client.from('homeworks').insert({
      teacher_id: teacherB.id,
      class_id:   classA_id,
      school_id:  schoolA.id,  // ← SAHTE school_id
      title:      'school_id spoof attack',
      subject:    'Saldırı',
      due_date:   '2026-12-31',
      description: null,
    })
    expect(error, 'school_id spoofing engellenmiş olmalı').not.toBeNull()
  })

  it('okul B öğretmeni okul A school_id ile öğrenci ekleyemez', async () => {
    const client = createUserClient(tokenB)
    const { error } = await client.from('students').insert({
      full_name:      'Spoof Student',
      student_number: null,
      class_id:       classA_id,
      school_id:      schoolA.id,  // ← SAHTE school_id
    })
    expect(error, 'school_id spoofing (students) engellenmiş olmalı').not.toBeNull()
  })

  it('okul B öğretmeni okul A school_id ile yoklama ekleyemez', async () => {
    const client = createUserClient(tokenB)
    const { error } = await client.from('attendance').insert({
      teacher_id: teacherB.id,
      class_id:   classA_id,
      student_id: studentA_id,
      school_id:  schoolA.id,  // ← SAHTE school_id
      date:       '2026-01-15',
      status:     'present',
    })
    expect(error, 'school_id spoofing (attendance) engellenmiş olmalı').not.toBeNull()
  })
})

// ─── 2. teacher_id forgery (INSERT) ──────────────────────────────────────────
describe('Saldırı 2: teacher_id forgery — başka öğretmen adına veri yazma', () => {
  /**
   * Vektör: Öğretmen A2, teacher_id = teacherA.id yazarak
   * öğretmen A adına ödev veya yoklama oluşturmaya çalışır.
   * Korunma: RLS WITH CHECK (teacher_id = auth.uid())
   */

  it('öğretmen A2 öğretmen A adına homework ekleyemez', async () => {
    const client = createUserClient(tokenA2)
    const { error } = await client.from('homeworks').insert({
      teacher_id:  teacherA.id,  // ← SAHTE teacher_id
      class_id:    classA_id,
      school_id:   schoolA.id,
      title:       'teacher_id forgery attack',
      subject:     'Saldırı',
      due_date:    '2026-12-31',
      description: null,
    })
    expect(error, 'teacher_id forgery engellenmiş olmalı').not.toBeNull()
  })

  it('öğretmen A2 öğretmen A adına yoklama ekleyemez', async () => {
    const client = createUserClient(tokenA2)
    const { error } = await client.from('attendance').insert({
      teacher_id: teacherA.id,  // ← SAHTE teacher_id
      class_id:   classA_id,
      student_id: studentA_id,
      school_id:  schoolA.id,
      date:       '2026-01-15',
      status:     'present',
    })
    expect(error, 'teacher_id forgery (attendance) engellenmiş olmalı').not.toBeNull()
  })
})

// ─── 3. ID-bazlı doğrudan erişim ─────────────────────────────────────────────
describe('Saldırı 3: UUID bilinen kayda doğrudan erişim', () => {
  /**
   * Vektör: Saldırgan tam UUID'yi bilse de RLS USING koşulu
   * okul eşleşmesi olmadan sonuç döndürmez.
   */

  it('okul B ogretmeni okul A homework UUID bilse bile okuyamaz', async () => {
    const client = createUserClient(tokenB)
    const { data } = await client.from('homeworks').select('id').eq('id', homeworkA_id)
    expect(data ?? [], 'UUID bilgisi ile cross-school okuma engellenmiş olmalı').toHaveLength(0)
  })

  it('okul B ogretmeni okul A student UUID bilse bile okuyamaz', async () => {
    const client = createUserClient(tokenB)
    const { data } = await client.from('students').select('id').eq('id', studentA_id)
    expect(data ?? []).toHaveLength(0)
  })

  it('anonim kullanıcı hiçbir UUID ile kayda erişemez', async () => {
    const client = createAnonClient()
    const { data: hw  } = await client.from('homeworks').select('id').eq('id', homeworkA_id)
    const { data: stu } = await client.from('students').select('id').eq('id', studentA_id)
    const { data: cls } = await client.from('classes').select('id').eq('id', classA_id)
    expect(hw  ?? []).toHaveLength(0)
    expect(stu ?? []).toHaveLength(0)
    expect(cls ?? []).toHaveLength(0)
  })
})

// ─── 4. Profile manipulation ─────────────────────────────────────────────────
describe('Saldırı 4: profil manipülasyonu', () => {
  /**
   * Vektör A: school_id değiştirme girişimi — başka okula geçiş
   * Korunma: prevent_school_id_reassignment trigger'ı
   *
   * Vektör B: role yükseltme girişimi — ogretmen → mudur
   * Korunma: prevent_role_change trigger'ı (eğer varsa)
   *           NOT: Bu trigger migration'larda açıkça görünmüyor.
   *           Test fail ederse → güvenlik açığı belgesi.
   */

  it('öğretmen kendi school_id\'sini değiştiremez — trigger koruması', async () => {
    const client = createUserClient(tokenA)
    const { error } = await client
      .from('profiles')
      .update({ school_id: schoolB.id })  // başka okula geç
      .eq('id', teacherA.id)

    // Seçenek 1: trigger hata fırlatır → error not null
    // Seçenek 2: trigger yoksa kayıt değişir → güvenlik açığı
    if (!error) {
      // Trigger yoksa gerçek değeri kontrol et
      const { data } = await serviceDb.from('profiles').select('school_id').eq('id', teacherA.id).single()
      expect(
        (data as { school_id: string }).school_id,
        'school_id değiştirilmiş! prevent_school_id_reassignment trigger eksik olabilir.'
      ).toBe(schoolA.id)
    } else {
      expect(error.message).toMatch(/school_id değiştirilemez/i)
    }
  })

  it('öğretmen kendi okulunun profillerini görebilir — başka okulun profilleri görünmez', async () => {
    const client = createUserClient(tokenA)

    // teacherB okul B'de — okul A öğretmeni göremez
    const { data: otherSchoolProfile } = await client
      .from('profiles')
      .select('id, school_id')
      .eq('id', teacherB.id)

    // profiles_school_read policy: school_id = current_school_id() OR id = auth.uid()
    expect(otherSchoolProfile ?? []).toHaveLength(0)
  })

  it('öğretmen başka öğretmenin profilini güncelleyemez', async () => {
    const client = createUserClient(tokenA)

    // profiles_self_update policy: USING (id = auth.uid())
    // teacherA2'nin profilini güncellemek
    const { data, error } = await client
      .from('profiles')
      .update({ full_name: 'Hacked Name' })
      .eq('id', teacherA2.id)
      .select('id')

    // error null olabilir ama 0 satır etkilenmeli
    expect(error).toBeNull()
    expect(data ?? []).toHaveLength(0)

    // Değer değişmedi mi?
    const { data: check } = await serviceDb.from('profiles').select('full_name').eq('id', teacherA2.id).single()
    expect((check as { full_name: string }).full_name).not.toBe('Hacked Name')
  })
})

// ─── 5. NULL injection ────────────────────────────────────────────────────────
describe('Saldırı 5: NULL school_id injection', () => {
  /**
   * Vektör: school_id = NULL ile INSERT → eğer politika NULL school_id'yi
   * farklı davranırsa izolasyon bozulabilir.
   * Korunma: NOT NULL constraint (Phase 3 migration) + RLS WITH CHECK
   */

  it('school_id = NULL ile homework eklenemez — NOT NULL constraint', async () => {
    const client = createUserClient(tokenA)
    const { error } = await client.from('homeworks').insert({
      teacher_id:  teacherA.id,
      class_id:    classA_id,
      school_id:   null,  // ← NULL injection
      title:       'null school_id attack',
      subject:     'X',
      due_date:    '2026-12-31',
      description: null,
    })
    expect(error, 'NULL school_id engellenmiş olmalı').not.toBeNull()
  })

  it('school_id = NULL ile öğrenci eklenemez', async () => {
    const client = createUserClient(tokenA)
    const { error } = await client.from('students').insert({
      full_name:      'null inject student',
      student_number: null,
      class_id:       classA_id,
      school_id:      null,  // ← NULL injection
    })
    expect(error, 'NULL school_id (students) engellenmiş olmalı').not.toBeNull()
  })
})

// ─── 6. Horizontal privilege escalation (aynı okul) ─────────────────────────
describe('Saldırı 6: aynı okul içi yatay yetki yükseltme', () => {
  /**
   * Vektör: Aynı okuldaki öğretmen A2, öğretmen A'nın ödevini silmeye çalışır.
   * Korunma: RLS USING (teacher_id = auth.uid() OR is_zumre_baskani_in_school())
   */

  it('aynı okuldaki öğretmen başka öğretmenin ödevini silemez', async () => {
    const client = createUserClient(tokenA2)
    await client.from('homeworks').delete().eq('id', homeworkA_id)

    // Kayıt hâlâ var mı?
    const { data } = await serviceDb.from('homeworks').select('id').eq('id', homeworkA_id)
    expect(data ?? [], 'Ödev silinmiş olmamalı').toHaveLength(1)
  })

  it('aynı okuldaki öğretmen başka öğretmenin yoklamasını güncelleyemez', async () => {
    // Önce teacherA adına service ile yoklama oluştur
    const { data: att } = await serviceDb
      .from('attendance')
      .insert({
        teacher_id: teacherA.id, class_id: classA_id, student_id: studentA_id,
        school_id: schoolA.id, date: '2026-02-01', status: 'present',
      })
      .select('id').single()
    const attId = att!.id

    const client = createUserClient(tokenA2)
    const { data, error } = await client
      .from('attendance')
      .update({ status: 'absent' })
      .eq('id', attId)
      .select('id')

    expect(error).toBeNull()
    expect(data ?? []).toHaveLength(0)  // 0 satır etkilendi

    // Orijinal değer korunmuş mu?
    const { data: check } = await serviceDb.from('attendance').select('status').eq('id', attId).single()
    expect((check as { status: string }).status).toBe('present')

    // Temizle
    await serviceDb.from('attendance').delete().eq('id', attId)
  })
})

// ─── 7. Toplu veri sızdırma (SELECT *) ───────────────────────────────────────
describe('Saldırı 7: SELECT * toplu veri sızdırma girişimi', () => {
  /**
   * Vektör: Okul B öğretmeni SELECT * sorgularıyla tüm DB'yi taramaya çalışır.
   * Korunma: RLS USING (school_id = current_school_id()) her tabloda
   */

  it('okul B öğretmeni homeworks tablosunda okul A verisi göremez', async () => {
    const client = createUserClient(tokenB)
    const { data } = await client.from('homeworks').select('id, school_id').limit(100)
    const leaked = (data ?? []).filter((r: { school_id: string }) => r.school_id === schoolA.id)
    expect(leaked).toHaveLength(0)
  })

  it('okul B öğretmeni students tablosunda okul A verisi göremez', async () => {
    const client = createUserClient(tokenB)
    const { data } = await client.from('students').select('id, school_id').limit(100)
    const leaked = (data ?? []).filter((r: { school_id: string }) => r.school_id === schoolA.id)
    expect(leaked).toHaveLength(0)
  })

  it('okul B öğretmeni profiles tablosunda okul A profilleri göremez', async () => {
    const client = createUserClient(tokenB)
    const { data } = await client.from('profiles').select('id, school_id').limit(100)
    // profiles_school_read: school_id = current_school_id() OR id = auth.uid()
    // Sadece kendi profili veya okul B profilleri gelir
    const leaked = (data ?? []).filter(
      (r: { id: string; school_id: string }) =>
        r.school_id === schoolA.id && r.id !== teacherB.id
    )
    expect(leaked).toHaveLength(0)
  })

  it('anonim SELECT * her tabloda boş döner', async () => {
    const client = createAnonClient()
    const tables = ['homeworks', 'students', 'classes', 'profiles', 'attendance']
    for (const table of tables) {
      const { data } = await client.from(table).select('id').limit(10)
      expect(data ?? [], `anon SELECT * ${table} boş olmalı`).toHaveLength(0)
    }
  })
})
