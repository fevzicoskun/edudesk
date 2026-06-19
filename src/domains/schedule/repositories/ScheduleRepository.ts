import { createClient } from '@/src/infrastructure/supabase/server'
import type { Period, Slot } from '../scheduleMath'

// Not: createClient (kullanıcı oturumu) → RLS öğretmen-self politikalarını uygular.
export const ScheduleRepository = {
  async getByTeacher(teacherId: string, schoolId: string) {
    const db = await createClient()
    return db
      .from('lesson_schedules')
      .select('slots, periods')
      .eq('teacher_id', teacherId)
      .eq('school_id', schoolId)
      .maybeSingle()
  },

  async listSchoolClasses(schoolId: string) {
    const db = await createClient()
    return db
      .from('classes')
      .select('id, name')
      .eq('school_id', schoolId)
      .is('deleted_at', null)
      .order('grade')
      .order('name')
  },

  async upsert(row: { teacher_id: string; school_id: string; periods: Period[]; slots: Slot[] }) {
    const db = await createClient()
    return db.from('lesson_schedules').upsert(
      {
        teacher_id: row.teacher_id,
        school_id:  row.school_id,
        periods:    row.periods as unknown as never,
        slots:      row.slots as unknown as never,
      },
      { onConflict: 'school_id,teacher_id' },
    )
  },
}
