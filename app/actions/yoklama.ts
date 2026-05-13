'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused'

export async function saveAttendance(
  classId: string,
  date: string,
  records: { studentId: string; status: AttendanceStatus }[]
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Giriş gerekli' }

  const rows = records.map(r => ({
    teacher_id: user.id,
    class_id: classId,
    student_id: r.studentId,
    date,
    status: r.status,
  }))

  const { error } = await supabase
    .from('attendance')
    .upsert(rows, { onConflict: 'class_id,student_id,date' })

  revalidatePath('/yoklama')
  return { error: error?.message }
}

export async function getAttendanceForDate(classId: string, date: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('attendance')
    .select('student_id, status')
    .eq('class_id', classId)
    .eq('date', date)

  return { data, error }
}

export async function getAttendanceHistory(classId: string, days = 14) {
  const supabase = await createClient()
  const since = new Date()
  since.setDate(since.getDate() - days)
  const sinceStr = since.toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('attendance')
    .select('student_id, date, status')
    .eq('class_id', classId)
    .gte('date', sinceStr)
    .order('date', { ascending: false })

  return { data, error }
}
