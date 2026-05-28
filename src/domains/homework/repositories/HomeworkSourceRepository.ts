import { createClient } from '@/src/infrastructure/supabase/server'

export const HomeworkSourceRepository = {
  async findByTeacher(teacherId: string, schoolId: string) {
    const supabase = await createClient()
    return supabase
      .from('homework_sources')
      .select('id, name, subject')
      .eq('teacher_id', teacherId)
      .eq('school_id', schoolId)
      .eq('active', true)
      .order('name')
  },

  async insert(data: {
    teacher_id: string
    school_id:  string
    name:       string
    subject:    string | null
  }) {
    const supabase = await createClient()
    return supabase.from('homework_sources').insert(data).select('id, name, subject, active, created_at').single()
  },

  async deactivate(id: string, teacherId: string, schoolId: string) {
    const supabase = await createClient()
    return supabase
      .from('homework_sources')
      .update({ active: false })
      .eq('id', id)
      .eq('teacher_id', teacherId)
      .eq('school_id', schoolId)
  },

  async findHomeworkDates(teacherId: string, schoolId: string, since: string) {
    const supabase = await createClient()
    return supabase
      .from('homeworks')
      .select('source_id, assigned_date')
      .eq('teacher_id', teacherId)
      .eq('school_id', schoolId)
      .is('deleted_at', null)
      .not('source_id', 'is', null)
      .gte('assigned_date', since)
  },
}
