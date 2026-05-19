import { createClient } from '@/src/infrastructure/supabase/server'

export const ScheduleRepository = {
  async insertSchedule(data: {
    school_id:     string
    schedule_type: 'resmi' | 'okul'
    type_label:    string
    teacher_id:    string | null
    class_id:      string | null
    file_url:      string
    file_name:     string
    created_by:    string
  }) {
    const supabase = await createClient()
    return supabase.from('lesson_schedules').insert({
      ...data,
      slots:        [],
      period_count: 8,
    })
  },

  async updateScheduleFile(id: string, schoolId: string, file_url: string, file_name: string) {
    const supabase = await createClient()
    return supabase
      .from('lesson_schedules')
      .update({ file_url, file_name })
      .eq('id', id)
      .eq('school_id', schoolId)
  },

  async updateOkulTypeLabel(school_id: string, type_label: string) {
    const supabase = await createClient()
    return supabase
      .from('lesson_schedules')
      .update({ type_label })
      .eq('school_id', school_id)
      .eq('schedule_type', 'okul')
  },

  async deleteSchedule(id: string, schoolId: string) {
    const supabase = await createClient()
    return supabase.from('lesson_schedules').delete().eq('id', id).eq('school_id', schoolId)
  },
}
