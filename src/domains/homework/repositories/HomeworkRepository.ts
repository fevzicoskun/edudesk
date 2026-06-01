import { createClient } from '@/src/infrastructure/supabase/server'
import type { SubmissionStatus } from '../types'

export const HomeworkRepository = {
  async insertHomework(data: {
    teacher_id:  string
    school_id:   string
    class_id:    string
    title:       string
    description: string | null
    subject:     string
    due_date:    string | null
    source_id:   string | null
    is_template?: boolean
  }) {
    const supabase = await createClient()
    return supabase.from('homeworks').insert(data).select('id').single()
  },

  async findHomeworkTeacher(homeworkId: string, schoolId: string) {
    const supabase = await createClient()
    return supabase
      .from('homeworks')
      .select('teacher_id, due_date')
      .eq('id', homeworkId)
      .eq('school_id', schoolId)
      .single()
  },

  async upsertSubmissionStatus(data: {
    homework_id: string
    student_id: string
    status: SubmissionStatus
    school_id: string
    updated_at: string
  }) {
    const supabase = await createClient()
    return supabase
      .from('homework_submissions')
      .upsert(data, { onConflict: 'homework_id,student_id' })
  },

  async upsertSubmissionsStatus(rows: {
    homework_id: string
    student_id: string
    school_id: string
    status: SubmissionStatus
    updated_at: string
  }[]) {
    const supabase = await createClient()
    return supabase
      .from('homework_submissions')
      .upsert(rows, { onConflict: 'homework_id,student_id' })
  },

  async upsertSubmissionNote(data: {
    homework_id: string
    student_id: string
    note: string | null
    school_id: string
    updated_at: string
  }) {
    const supabase = await createClient()
    return supabase
      .from('homework_submissions')
      .upsert(data, { onConflict: 'homework_id,student_id' })
  },

  async updateHomework(
    homeworkId: string,
    teacherId: string,
    schoolId: string,
    data: {
      title: string
      subject: string
      description: string | null
      due_date: string | null
    }
  ) {
    const supabase = await createClient()
    return supabase.from('homeworks')
      .update(data)
      .eq('id', homeworkId)
      .eq('teacher_id', teacherId)
      .eq('school_id', schoolId)
      .is('deleted_at', null)
  },

  async softDeleteHomework(homeworkId: string, teacherId: string, schoolId: string) {
    const supabase = await createClient()
    return supabase.from('homeworks')
      .update({ deleted_at: new Date().toISOString(), deleted_by: teacherId })
      .eq('id', homeworkId).eq('teacher_id', teacherId).eq('school_id', schoolId)
  },

  // Zümre başkanı: teacher_id filtresi yok, okul kapsamlı silme
  async softDeleteHomeworkAsManager(homeworkId: string, deletedBy: string, schoolId: string) {
    const supabase = await createClient()
    return supabase.from('homeworks')
      .update({ deleted_at: new Date().toISOString(), deleted_by: deletedBy })
      .eq('id', homeworkId).eq('school_id', schoolId)
  },

  async restoreHomework(homeworkId: string, schoolId: string) {
    const supabase = await createClient()
    return supabase.from('homeworks')
      .update({ deleted_at: null, deleted_by: null })
      .eq('id', homeworkId).eq('school_id', schoolId)
  },

  async findStudentHomeworkProfile(studentId: string, classId: string, schoolId: string) {
    const supabase = await createClient()
    const [studentRes, homeworksRes] = await Promise.all([
      supabase
        .from('students')
        .select('full_name, student_number, veli_ad, veli_telefon')
        .eq('id', studentId)
        .eq('school_id', schoolId)
        .single(),
      supabase
        .from('homeworks')
        .select('id, title, subject, due_date')
        .eq('class_id', classId)
        .eq('school_id', schoolId)
        .eq('is_template', false)
        .is('deleted_at', null)
        .order('due_date', { ascending: false }),
    ])

    const homeworkIds = (homeworksRes.data ?? []).map(h => h.id)
    const subsRes = homeworkIds.length > 0
      ? await supabase
          .from('homework_submissions')
          .select('homework_id, status, note')
          .in('homework_id', homeworkIds)
          .eq('student_id', studentId)
      : { data: [] as { homework_id: string; status: string; note: string | null }[] }

    return {
      student: studentRes.data as { full_name: string; student_number: string | null; veli_ad: string | null; veli_telefon: string | null } | null,
      homeworks: homeworksRes.data ?? [],
      submissions: subsRes.data ?? [],
    }
  },
}
