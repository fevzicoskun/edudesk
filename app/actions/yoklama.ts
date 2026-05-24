'use server'

import { createClient } from '@/src/infrastructure/supabase/server'
import { getCurrentProfile } from '@/src/shared/auth'
import { inngest } from '@/src/infrastructure/inngest'
import { UUID } from '@/src/shared/validation'

export type AttendanceStatus = 'present' | 'absent' | 'late'

export interface AttendanceEntry {
  studentId: string
  status:    AttendanceStatus
}

export async function getYoklama(
  classId: string,
  date: string
): Promise<Record<string, AttendanceStatus>> {
  UUID.parse(classId)
  const profile  = await getCurrentProfile()
  if (!profile?.school_id) throw new Error('Okul bilgisi bulunamadı')

  const supabase = await createClient()
  const { data } = await supabase
    .from('attendance')
    .select('student_id, status')
    .eq('class_id', classId)
    .eq('date', date)

  const map: Record<string, AttendanceStatus> = {}
  for (const row of data ?? []) {
    map[row.student_id] = row.status as AttendanceStatus
  }
  return map
}

export async function saveYoklama(
  classId: string,
  date:    string,
  entries: AttendanceEntry[]
): Promise<void> {
  UUID.parse(classId)
  const profile  = await getCurrentProfile()
  if (!profile?.school_id) throw new Error('Okul bilgisi bulunamadı')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Oturum bulunamadı')

  const rows = entries.map(e => ({
    class_id:   classId,
    student_id: e.studentId,
    teacher_id: user.id,
    school_id:  profile.school_id,
    date,
    status:     e.status,
  }))

  const { error } = await supabase
    .from('attendance')
    .upsert(rows, { onConflict: 'class_id,student_id,date' })
  if (error) throw new Error(error.message)

  const absentIds = entries
    .filter(e => e.status === 'absent' || e.status === 'late')
    .map(e => e.studentId)

  if (absentIds.length > 0) {
    try {
      await inngest.send(
        absentIds.map(studentId => ({
          name: 'attendance/absent' as const,
          data: { studentId, classId, date, schoolId: profile.school_id },
        }))
      )
    } catch {
      // Bildirim gönderilemedi, yoklama kaydı yine de tamamlandı
    }
  }
}
