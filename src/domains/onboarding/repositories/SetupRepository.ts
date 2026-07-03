import { createClient } from '@/src/infrastructure/supabase/server'

// RLS altında hafif count sorguları (head:true). İş mantığı yok.
export const SetupRepository = {
  // Okulda müdür dışında üye var mı? (davet ✓ koşulu)
  async countOtherMembers(schoolId: string) {
    const db = await createClient()
    return db
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('school_id', schoolId)
      .neq('role', 'mudur')
  },

  // Öğretmen adım sayaçları — 4 paralel count.
  async teacherCounts(userId: string, schoolId: string) {
    const db = await createClient()
    return Promise.all([
      db.from('teacher_classes')
        .select('class_id', { count: 'exact', head: true })
        .eq('teacher_id', userId),
      db.from('lesson_schedules')
        .select('id', { count: 'exact', head: true })
        .eq('teacher_id', userId)
        .eq('school_id', schoolId),
      db.from('attendance')
        .select('id', { count: 'exact', head: true })
        .eq('teacher_id', userId)
        .eq('school_id', schoolId),
      db.from('homeworks')
        .select('id', { count: 'exact', head: true })
        .eq('teacher_id', userId)
        .eq('school_id', schoolId)
        .is('deleted_at', null),
    ])
  },
}
