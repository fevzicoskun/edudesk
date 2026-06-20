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

  // Müdür/MY: okuldaki tüm nöbetler + öğretmen adı. RLS müdür/MY'ye tüm okul SELECT verir;
  // öğretmen çağırırsa RLS yalnız kendi satırını döndürür (güvenli ama UI'da role guard'lı).
  // teacher_id → auth.users FK olduğu için PostgREST embed edemez; profiles ayrı sorguyla map'lenir.
  async listSchoolDuties(schoolId: string) {
    const db = await createClient()
    const { data: duties, error } = await db
      .from('teacher_duties')
      .select('teacher_id, day_of_week, time_range, location, notes')
      .eq('school_id', schoolId)
      .order('day_of_week')
    if (error || !duties?.length) return { data: [], error }

    const ids = [...new Set(duties.map(d => d.teacher_id))]
    const { data: profs } = await db.from('profiles').select('id, full_name').in('id', ids)
    const nameById = new Map((profs ?? []).map(p => [p.id as string, p.full_name as string | null]))

    return {
      data: duties.map(d => ({
        teacher_id: d.teacher_id,
        teacherName: nameById.get(d.teacher_id) ?? '—',
        day_of_week: d.day_of_week,
        time_range: d.time_range,
        location: d.location,
        notes: d.notes,
      })),
      error: null,
    }
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
