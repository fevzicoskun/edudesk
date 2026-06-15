import { createClient } from '@/src/infrastructure/supabase/server'
import type { SubmissionStatus } from '../types'

export type SubmissionLogEntry = {
  old_status:      string | null
  new_status:      string
  changed_at:      string
  changed_by_name: string
}

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
      .is('deleted_at', null)
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

  async classExistsInSchool(classId: string, schoolId: string): Promise<boolean> {
    const supabase = await createClient()
    const { data } = await supabase
      .from('classes')
      .select('id')
      .eq('id', classId)
      .eq('school_id', schoolId)
      .is('deleted_at', null)
      .maybeSingle()
    return data !== null
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
      source_id: string | null
      class_id: string
    }
  ) {
    const supabase = await createClient()
    const { data: rows, error } = await supabase.from('homeworks')
      .update(data)
      .eq('id', homeworkId)
      .eq('teacher_id', teacherId)
      .eq('school_id', schoolId)
      .is('deleted_at', null)
      .select('id')
    if (error) return { error }
    if (!rows || rows.length === 0) return { error: { message: 'Ödev bulunamadı veya yetkiniz yok.' } }
    return { error: null }
  },

  async updateHomeworkAsManager(
    homeworkId: string,
    schoolId: string,
    data: {
      title: string
      subject: string
      description: string | null
      due_date: string | null
      source_id: string | null
      class_id: string
    }
  ) {
    const supabase = await createClient()
    const { data: rows, error } = await supabase.from('homeworks')
      .update(data)
      .eq('id', homeworkId)
      .eq('school_id', schoolId)
      .is('deleted_at', null)
      .select('id')
    if (error) return { error }
    if (!rows || rows.length === 0) return { error: { message: 'Ödev bulunamadı.' } }
    return { error: null }
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

  // Öğretmen kendi ödevlerini toplu siler — teacher_id ile sınırlı
  async bulkSoftDeleteHomeworks(ids: string[], teacherId: string, schoolId: string) {
    const supabase = await createClient()
    return supabase.from('homeworks')
      .update({ deleted_at: new Date().toISOString(), deleted_by: teacherId })
      .in('id', ids)
      .eq('teacher_id', teacherId)
      .eq('school_id', schoolId)
      .is('deleted_at', null)
  },

  async restoreHomework(homeworkId: string, schoolId: string) {
    const supabase = await createClient()
    return supabase.from('homeworks')
      .update({ deleted_at: null, deleted_by: null })
      .eq('id', homeworkId).eq('school_id', schoolId)
  },

  async findTemplatesByClass(classId: string, teacherId: string, schoolId: string) {
    const supabase = await createClient()
    return supabase
      .from('homeworks')
      .select('id, title, subject, description, source_id')
      .eq('class_id', classId)
      .eq('teacher_id', teacherId)
      .eq('school_id', schoolId)
      .eq('is_template', true)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(10)
  },

  async findCurrentSubmissionStatus(homeworkId: string, studentId: string, schoolId: string) {
    const supabase = await createClient()
    return supabase
      .from('homework_submissions')
      .select('status')
      .eq('homework_id', homeworkId)
      .eq('student_id', studentId)
      .eq('school_id', schoolId)
      .maybeSingle()
  },

  async findCurrentSubmissionStatuses(homeworkId: string, studentIds: string[], schoolId: string) {
    const supabase = await createClient()
    return supabase
      .from('homework_submissions')
      .select('student_id, status')
      .eq('homework_id', homeworkId)
      .in('student_id', studentIds)
      .eq('school_id', schoolId)
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

    if (studentRes.error || homeworksRes.error) {
      return {
        error: studentRes.error?.message ?? homeworksRes.error?.message,
        student: null, homeworks: [], submissions: [],
      }
    }

    const homeworkIds = (homeworksRes.data ?? []).map(h => h.id)
    const subsRes = homeworkIds.length > 0
      ? await supabase
          .from('homework_submissions')
          .select('homework_id, status, note')
          .in('homework_id', homeworkIds)
          .eq('student_id', studentId)
          .eq('school_id', schoolId)
      : { data: [] as { homework_id: string; status: string; note: string | null }[], error: null }

    if (subsRes.error) {
      return {
        error: subsRes.error.message,
        student: null,
        homeworks: [],
        submissions: [],
      }
    }

    return {
      student: studentRes.data as { full_name: string; student_number: string | null; veli_ad: string | null; veli_telefon: string | null } | null,
      homeworks: homeworksRes.data ?? [],
      submissions: subsRes.data ?? [],
    }
  },

  async insertSubmissionLog(log: {
    homework_id: string
    student_id:  string
    school_id:   string
    changed_by:  string
    old_status:  string | null
    new_status:  string
    changed_at:  string
  }) {
    const supabase = await createClient()
    return supabase.from('homework_submission_logs').insert(log)
  },

  async insertSubmissionLogs(logs: Array<{
    homework_id: string
    student_id:  string
    school_id:   string
    changed_by:  string
    old_status:  string | null
    new_status:  string
    changed_at:  string
  }>) {
    const supabase = await createClient()
    return supabase.from('homework_submission_logs').insert(logs)
  },

  async findSubmissionLogs(homeworkId: string, studentId: string, schoolId: string) {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('homework_submission_logs')
      .select('old_status, new_status, changed_at, changed_by')
      .eq('homework_id', homeworkId)
      .eq('student_id', studentId)
      .eq('school_id', schoolId)
      .order('changed_at', { ascending: false })
    if (error) return { data: null, error }
    const profileIds = [...new Set((data ?? []).map(r => r.changed_by))]
    const { data: profiles } = profileIds.length > 0
      ? await supabase.from('profiles').select('id, full_name').in('id', profileIds)
      : { data: [] as { id: string; full_name: string | null }[] }
    const nameMap = new Map((profiles ?? []).map(p => [p.id, p.full_name ?? '—']))
    const entries: SubmissionLogEntry[] = (data ?? []).map(r => ({
      old_status:      r.old_status,
      new_status:      r.new_status,
      changed_at:      r.changed_at,
      changed_by_name: nameMap.get(r.changed_by) ?? '—',
    }))
    return { data: entries, error: null }
  },
}
