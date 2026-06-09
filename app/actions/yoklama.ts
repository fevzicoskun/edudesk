'use server'

import { createClient } from '@/src/infrastructure/supabase/server'
import { inngest } from '@/src/infrastructure/inngest'
import { UUID } from '@/src/shared/validation'
import { getAbility } from '@/src/shared/authorization/server'
import { P } from '@/src/shared/permissions'
import { logger } from '@/src/infrastructure/observability/logger'
import type { AttendanceStatus } from '@/src/domains/attendance/types'

export type { AttendanceStatus }

export interface AttendanceEntry {
  studentId: string
  status:    AttendanceStatus
}

export async function getYoklama(
  classId: string,
  date: string
): Promise<Record<string, AttendanceStatus>> {
  UUID.parse(classId)
  const ability = await getAbility()
  if (!ability) throw new Error('Giriş gerekli')
  if (ability.cannot(P.ATTENDANCE.READ)) throw new Error('Bu işlem için yetkiniz yok')

  const supabase = await createClient()

  const { data: cls } = await supabase
    .from('classes')
    .select('id')
    .eq('id', classId)
    .eq('school_id', ability.schoolId)
    .is('deleted_at', null)
    .single()
  if (!cls) throw new Error('Sınıf bulunamadı')

  const { data } = await supabase
    .from('attendance')
    .select('student_id, status')
    .eq('class_id', classId)
    .eq('school_id', ability.schoolId)
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
  const ability = await getAbility()
  if (!ability) throw new Error('Giriş gerekli')
  if (ability.cannot(P.ATTENDANCE.UPDATE)) throw new Error('Bu işlem için yetkiniz yok')

  const supabase = await createClient()

  // Sınıfın bu okula ait olduğunu RLS-korumalı client ile doğrula
  const { data: cls } = await supabase
    .from('classes')
    .select('id')
    .eq('id', classId)
    .eq('school_id', ability.schoolId)
    .is('deleted_at', null)
    .single()
  if (!cls) throw new Error('Sınıf bulunamadı')

  const rows = entries.map(e => ({
    class_id:   classId,
    student_id: e.studentId,
    teacher_id: ability.userId,
    school_id:  ability.schoolId,
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
          data: { studentId, classId, date, schoolId: ability.schoolId },
        }))
      )
    } catch (e) {
      logger.error({ classId, date, absentCount: absentIds.length, err: e instanceof Error ? e.message : String(e) }, 'saveYoklama: Inngest event gönderilemedi')
    }
  }
}
