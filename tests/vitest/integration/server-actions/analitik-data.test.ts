/**
 * Analitik veri katmanı integration testleri.
 * DB gerçek Supabase ile çalışır; lib fonksiyonları edge case'ler için test edilir.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import {
  serviceDb,
  createTestSchool,
  createTestUser,
  cleanupTestData,
  type TestSchool,
  type TestUser,
} from '../../setup/db'
import { computeKpiCards, computeRiskyStudents } from '@/src/domains/homework/lib/analitik'
import type { AnalitikHomework, AnalitikSubmission, AnalitikStudent } from '@/src/domains/homework/lib/analitik'

let schoolA: TestSchool
let schoolB: TestSchool
let teacherA: TestUser
let teacherB: TestUser
let classAId: string
let classBId: string
const hwIds: string[] = []

beforeAll(async () => {
  schoolA  = await createTestSchool('_ANALITIK_A')
  schoolB  = await createTestSchool('_ANALITIK_B')
  teacherA = await createTestUser({ role: 'ogretmen', schoolId: schoolA.id })
  teacherB = await createTestUser({ role: 'ogretmen', schoolId: schoolB.id })

  const { data: clsA } = await serviceDb
    .from('classes')
    .insert({ name: 'Analitik A', grade: 5, academic_year: '2025-2026', school_id: schoolA.id })
    .select('id').single()
  classAId = clsA!.id

  const { data: clsB } = await serviceDb
    .from('classes')
    .insert({ name: 'Analitik B', grade: 5, academic_year: '2025-2026', school_id: schoolB.id })
    .select('id').single()
  classBId = clsB!.id

  const { data: hwsA, error: hwsErr } = await serviceDb
    .from('homeworks')
    .insert([
      { class_id: classAId, teacher_id: teacherA.id, school_id: schoolA.id, title: 'Ödev A1', subject: 'Mat', due_date: '2030-01-01', is_template: false },
      { class_id: classAId, teacher_id: teacherA.id, school_id: schoolA.id, title: 'Ödev A2', subject: 'Mat', due_date: '2030-01-08', is_template: false },
      { class_id: classAId, teacher_id: teacherA.id, school_id: schoolA.id, title: 'Ödev A3', subject: 'Mat', due_date: '2030-01-15', is_template: false },
    ])
    .select('id')
  if (hwsErr) throw new Error(`homeworks insert hatası: ${hwsErr.message}`)
  hwIds.push(...(hwsA ?? []).map(h => h.id))
})

afterAll(async () => {
  if (hwIds.length) {
    await serviceDb.from('homework_submissions').delete().in('homework_id', hwIds)
    await serviceDb.from('homeworks').delete().in('id', hwIds)
    await serviceDb.from('classes').delete().in('id', [classAId, classBId])
  }
  await cleanupTestData({ userIds: [teacherA.id, teacherB.id], schoolIds: [schoolA.id, schoolB.id] })
})

describe('RBAC: okul izolasyonu', () => {
  it('teacher_id + school_id filtresi → yalnızca kendi ödevler döner', async () => {
    const { data } = await serviceDb
      .from('homeworks')
      .select('id, teacher_id')
      .eq('school_id', schoolA.id)
      .eq('teacher_id', teacherA.id)
      .is('deleted_at', null)
      .eq('is_template', false)

    expect(data).toHaveLength(3)
    expect(data?.every(h => h.teacher_id === teacherA.id)).toBe(true)
  })

  it('Okul B filtresiyle Okul A öğretmeninin verisi dönmez', async () => {
    const { data } = await serviceDb
      .from('homeworks')
      .select('id')
      .eq('school_id', schoolB.id)
      .eq('teacher_id', teacherA.id)

    expect(data).toHaveLength(0)
  })
})

describe('computeKpiCards — sınır durumlar', () => {
  it('boş arrays → sıfır döner, crash yok', () => {
    const result = computeKpiCards([], [], [])
    expect(result).toEqual({ totalHomeworks: 0, avgCompletionPct: 0, riskyStudentCount: 0, pendingReviewCount: 0 })
  })

  it('öğrencisi olmayan sınıfın ödevi → avgCompletionPct=0, crash yok', () => {
    const homeworks: AnalitikHomework[] = [
      { id: 'h-edge', class_id: 'no-students-class', teacher_id: 't1', due_date: '2030-01-01', title: 'Test' },
    ]
    const result = computeKpiCards(homeworks, [], [])
    expect(result.totalHomeworks).toBe(1)
    expect(result.avgCompletionPct).toBe(0)
  })
})

describe('computeRiskyStudents — sınır durumlar', () => {
  it('tam 3 eksik → riskli sayılır', () => {
    const students: AnalitikStudent[] = [{ id: 's1', class_id: 'c1', full_name: 'Test', student_number: null }]
    const homeworks: AnalitikHomework[] = [
      { id: 'h1', class_id: 'c1', teacher_id: 't1', due_date: '2026-01-01', title: 'H1' },
      { id: 'h2', class_id: 'c1', teacher_id: 't1', due_date: '2026-01-08', title: 'H2' },
      { id: 'h3', class_id: 'c1', teacher_id: 't1', due_date: '2026-01-15', title: 'H3' },
    ]
    const submissions: AnalitikSubmission[] = [
      { homework_id: 'h1', student_id: 's1', status: 'yapilmadi' },
      { homework_id: 'h2', student_id: 's1', status: 'eksik' },
      { homework_id: 'h3', student_id: 's1', status: 'yapilmadi' },
    ]
    expect(computeRiskyStudents(students, homeworks, submissions)).toHaveLength(1)
  })

  it('tam 2 eksik → riskli sayılmaz', () => {
    const students: AnalitikStudent[] = [{ id: 's1', class_id: 'c1', full_name: 'Test', student_number: null }]
    const homeworks: AnalitikHomework[] = [
      { id: 'h1', class_id: 'c1', teacher_id: 't1', due_date: '2026-01-01', title: 'H1' },
      { id: 'h2', class_id: 'c1', teacher_id: 't1', due_date: '2026-01-08', title: 'H2' },
    ]
    const submissions: AnalitikSubmission[] = [
      { homework_id: 'h1', student_id: 's1', status: 'yapilmadi' },
      { homework_id: 'h2', student_id: 's1', status: 'eksik' },
    ]
    expect(computeRiskyStudents(students, homeworks, submissions)).toHaveLength(0)
  })
})
