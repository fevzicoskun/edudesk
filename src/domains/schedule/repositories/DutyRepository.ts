import { createClient } from '@/src/infrastructure/supabase/server'

// Not: createClient (kullanıcı oturumu) → RLS öğretmen-self politikalarını uygular.
// Öğretmen yalnız kendi nöbet satırını okur/yazar (teacher_duties RLS).
export const DutyRepository = {
  async getByTeacher(teacherId: string, schoolId: string) {
    const db = await createClient()
    return db
      .from('teacher_duties')
      .select('day_of_week, time_range, location, notes')
      .eq('teacher_id', teacherId)
      .eq('school_id', schoolId)
      .maybeSingle()
  },

  async upsert(row: {
    teacher_id: string
    school_id: string
    day_of_week: number
    time_range: string
    location: string
    notes: string | null
  }) {
    const db = await createClient()
    return db.from('teacher_duties').upsert(
      {
        teacher_id: row.teacher_id,
        school_id: row.school_id,
        day_of_week: row.day_of_week,
        time_range: row.time_range,
        location: row.location,
        notes: row.notes,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'school_id,teacher_id' },
    )
  },
}
