'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { UUID, attendanceStatusSchema, saveAttendanceSchema } from '@/lib/validation'

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused'

export async function saveAttendance(
  classId: string,
  date: string,
  records: { studentId: string; status: AttendanceStatus }[]
) {
  const parsed = saveAttendanceSchema.safeParse({ classId, date, records })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Geçersiz veri' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Giriş gerekli' }

  const rows = parsed.data.records.map(r => ({
    teacher_id: user.id,
    class_id: parsed.data.classId,
    student_id: r.studentId,
    date: parsed.data.date,
    status: r.status,
  }))

  const { error } = await supabase
    .from('attendance')
    .upsert(rows, { onConflict: 'class_id,student_id,date' })

  revalidatePath('/yoklama')
  return { error: error?.message }
}

export async function getAttendanceForDate(classId: string, date: string) {
  UUID.parse(classId)
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('attendance')
    .select('student_id, status')
    .eq('class_id', classId)
    .eq('date', date)

  return { data, error }
}

export async function getAttendanceHistory(classId: string, days = 14) {
  UUID.parse(classId)
  const safeDays = Math.min(Math.max(1, days), 90)

  const supabase = await createClient()
  const since = new Date()
  since.setDate(since.getDate() - safeDays)
  const sinceStr = since.toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('attendance')
    .select('student_id, date, status')
    .eq('class_id', classId)
    .gte('date', sinceStr)
    .order('date', { ascending: false })

  return { data, error }
}
