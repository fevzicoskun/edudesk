import { createClient } from '@/src/infrastructure/supabase/server'
import { createServiceClient } from '@/src/infrastructure/supabase/service'
import type { GradeColumn, GradeEntry, GradeType } from '../types'

export const GradeRepository = {
  async findColumnsByClass(classId: string, schoolId: string) {
    const supabase = await createClient()
    return supabase
      .from('grade_columns')
      .select('*')
      .eq('class_id', classId)
      .eq('school_id', schoolId)
      .order('exam_date', { nullsFirst: false })
      .order('created_at')
      .returns<GradeColumn[]>()
  },

  async insertColumn(data: {
    teacher_id: string
    class_id:   string
    school_id:  string
    title:      string
    grade_type: GradeType
    max_score:  number
    exam_date:  string | null
  }) {
    const supabase = await createClient()
    return supabase
      .from('grade_columns')
      .insert(data)
      .select()
      .single<GradeColumn>()
  },

  async updateColumn(
    columnId: string,
    teacherId: string,
    schoolId: string,
    data: Partial<Pick<GradeColumn, 'title' | 'grade_type' | 'max_score' | 'exam_date'>>,
  ) {
    const supabase = await createClient()
    return supabase
      .from('grade_columns')
      .update(data)
      .eq('id', columnId)
      .eq('teacher_id', teacherId)
      .eq('school_id', schoolId)
  },

  async deleteColumn(columnId: string, teacherId: string, schoolId: string) {
    const supabase = await createClient()
    return supabase
      .from('grade_columns')
      .delete()
      .eq('id', columnId)
      .eq('teacher_id', teacherId)
      .eq('school_id', schoolId)
  },

  async findColumnOwner(columnId: string, schoolId: string) {
    const supabase = await createClient()
    return supabase
      .from('grade_columns')
      .select('teacher_id')
      .eq('id', columnId)
      .eq('school_id', schoolId)
      .single()
  },

  async findEntriesByClass(classId: string, schoolId: string) {
    const supabase = await createClient()

    const { data: cols, error: colErr } = await supabase
      .from('grade_columns')
      .select('id')
      .eq('class_id', classId)
      .eq('school_id', schoolId)
    if (colErr) return { data: null, error: colErr }
    if (!cols?.length) return { data: [] as GradeEntry[], error: null }

    const columnIds = cols.map(c => c.id)
    return supabase
      .from('grade_entries')
      .select('*')
      .eq('school_id', schoolId)
      .in('grade_column_id', columnIds)
      .returns<GradeEntry[]>()
  },

  async upsertEntry(data: {
    grade_column_id: string
    student_id:      string
    school_id:       string
    score:           number | null
  }) {
    const supabase = await createClient()
    return supabase
      .from('grade_entries')
      .upsert(
        { ...data, updated_at: new Date().toISOString() },
        { onConflict: 'grade_column_id,student_id' },
      )
  },

  /** Service client — RLS bypass, export için */
  async findEntriesByClassServiceRole(classId: string, schoolId: string) {
    const db = createServiceClient()
    return db
      .from('grade_entries')
      .select('*, grade_columns!inner(title, grade_type, max_score, exam_date, class_id)')
      .eq('school_id', schoolId)
      .eq('grade_columns.class_id', classId)
      .returns<(GradeEntry & { grade_columns: Pick<GradeColumn, 'title' | 'grade_type' | 'max_score' | 'exam_date' | 'class_id'> })[]>()
  },
}
