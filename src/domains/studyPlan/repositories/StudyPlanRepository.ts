import { createClient } from '@/src/infrastructure/supabase/server'

const ITEM_COLS = 'id, student_id, teacher_id, subject, week_start, plan_date, source, description, status, note'

export interface PlanItemInsert {
  school_id: string
  student_id: string
  teacher_id: string
  subject: string
  week_start: string
  plan_date: string | null
  source: string | null
  description: string
  status: string
  note: string | null
}

export interface PlanItemPatch {
  description?: string
  source?: string | null
  plan_date?: string | null
  status?: string
  note?: string | null
}

// RLS okul-kapsamlı; öğretmen/sınıf kısıtı serviste + teacher_id filtreleriyle.
export const StudyPlanRepository = {
  async studentClassId(studentId: string, schoolId: string) {
    const db = await createClient()
    return db.from('students').select('class_id').eq('id', studentId).eq('school_id', schoolId).is('deleted_at', null).maybeSingle()
  },

  async isTeacherOfClass(teacherId: string, classId: string): Promise<boolean> {
    const db = await createClient()
    const { data } = await db.from('teacher_classes').select('class_id').eq('teacher_id', teacherId).eq('class_id', classId).maybeSingle()
    return !!data
  },

  async listStudentsOfClass(classId: string, schoolId: string) {
    const db = await createClient()
    return db.from('students').select('id, full_name, student_number')
      .eq('class_id', classId).eq('school_id', schoolId).is('deleted_at', null).order('full_name').limit(500)
  },

  async listTeacherItems(teacherId: string, schoolId: string, weekStart: string, studentIds?: string[]) {
    const db = await createClient()
    let q = db.from('study_plan_items').select(ITEM_COLS)
      .eq('teacher_id', teacherId).eq('school_id', schoolId).eq('week_start', weekStart)
      .order('plan_date', { ascending: true, nullsFirst: true }).order('created_at')
    if (studentIds) q = q.in('student_id', studentIds)
    return q.limit(2000)
  },

  async listStudentItems(studentId: string, schoolId: string, weekStart: string) {
    const db = await createClient()
    return db.from('study_plan_items').select(`${ITEM_COLS}, profiles(full_name)`)
      .eq('student_id', studentId).eq('school_id', schoolId).eq('week_start', weekStart)
      .order('plan_date', { ascending: true, nullsFirst: true }).order('created_at').limit(500)
  },

  async listSources(studentId: string, schoolId: string) {
    const db = await createClient()
    return db.from('student_sources').select('id, name, subject')
      .eq('student_id', studentId).eq('school_id', schoolId).eq('active', true).order('name')
  },

  async findSourceStudentId(id: string, schoolId: string) {
    const db = await createClient()
    return db.from('student_sources').select('student_id').eq('id', id).eq('school_id', schoolId).eq('active', true).maybeSingle()
  },

  async insertSource(row: { school_id: string; student_id: string; subject: string; name: string; created_by: string }) {
    const db = await createClient()
    return db.from('student_sources').insert(row).select('id').single()
  },

  async deactivateSource(id: string, schoolId: string) {
    const db = await createClient()
    return db.from('student_sources').update({ active: false }).eq('id', id).eq('school_id', schoolId).select('id')
  },

  async insertItems(rows: PlanItemInsert[]) {
    const db = await createClient()
    return db.from('study_plan_items').insert(rows).select('id')
  },

  async updateItem(id: string, teacherId: string, schoolId: string, patch: PlanItemPatch) {
    const db = await createClient()
    return db.from('study_plan_items').update(patch).eq('id', id).eq('teacher_id', teacherId).eq('school_id', schoolId).select('id')
  },

  async deleteItem(id: string, teacherId: string, schoolId: string) {
    const db = await createClient()
    return db.from('study_plan_items').delete().eq('id', id).eq('teacher_id', teacherId).eq('school_id', schoolId).select('id')
  },
}
