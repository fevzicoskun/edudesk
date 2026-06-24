import { createClient } from '@/src/infrastructure/supabase/server'

// RLS (tasks_own) zaten user_id=auth.uid() + school_id zorlar; eq filtreleri savunma katmanı.
const COLS = 'id, title, student_id, class_id, due_date, snoozed_until, done_at, created_at'

export const TaskRepository = {
  // Kullanıcının açık (done_at IS NULL) görevleri, yeni → eski.
  async listOpenForUser(userId: string, schoolId: string) {
    const db = await createClient()
    return db
      .from('tasks')
      .select(COLS)
      .eq('user_id', userId)
      .eq('school_id', schoolId)
      .is('done_at', null)
      .order('created_at', { ascending: false })
  },

  // Belirli öğrencinin açık görevleri (öğrenci profili yüzeyi).
  async listOpenForStudent(userId: string, schoolId: string, studentId: string) {
    const db = await createClient()
    return db
      .from('tasks')
      .select(COLS)
      .eq('user_id', userId)
      .eq('school_id', schoolId)
      .eq('student_id', studentId)
      .is('done_at', null)
      .order('created_at', { ascending: false })
  },

  // Yeni görev. Eklenen satırı id'siyle döndürür (optimistik liste için).
  async insert(row: {
    user_id: string
    school_id: string
    title: string
    student_id: string | null
    class_id: string | null
    due_date: string | null
  }) {
    const db = await createClient()
    return db.from('tasks').insert(row).select(COLS).single()
  },

  // Tamamla / geri-aç. done=true → done_at now; false → null.
  async setDone(id: string, userId: string, done: boolean) {
    const db = await createClient()
    return db
      .from('tasks')
      .update({ done_at: done ? new Date().toISOString() : null })
      .eq('id', id)
      .eq('user_id', userId)
  },

  // Ertele (untilDate) veya ertelemeyi kaldır (null).
  async setSnooze(id: string, userId: string, untilDate: string | null) {
    const db = await createClient()
    return db
      .from('tasks')
      .update({ snoozed_until: untilDate })
      .eq('id', id)
      .eq('user_id', userId)
  },

  async deleteById(id: string, userId: string) {
    const db = await createClient()
    return db.from('tasks').delete().eq('id', id).eq('user_id', userId)
  },
}
