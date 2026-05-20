'use server'

import { revalidatePath } from 'next/cache'
import { UUID } from '@/src/shared/validation'
import { requireSchoolId } from '@/src/shared/auth'
import { saveAttendanceSchema } from '@/src/domains/attendance/validators'
import { AttendanceService } from '@/src/domains/attendance/services/AttendanceService'
import { findByClassAndDate } from '@/src/queries/attendance'
import type { AttendanceStatus } from '@/src/domains/attendance/types'

export async function saveAttendance(
  classId: string,
  date: string,
  records: { studentId: string; status: AttendanceStatus }[]
) {
  const parsed = saveAttendanceSchema.safeParse({ classId, date, records })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Geçersiz veri' }

  const result = await AttendanceService.saveAttendance(
    parsed.data.classId,
    parsed.data.date,
    parsed.data.records
  )

  revalidatePath('/yoklama')
  return result
}

export async function getAttendanceForDate(classId: string, date: string) {
  await requireSchoolId()
  UUID.parse(classId)
  return findByClassAndDate(classId, date)
}

export async function getAttendanceHistory(classId: string, days = 14) {
  await requireSchoolId()
  UUID.parse(classId)
  return AttendanceService.getAttendanceHistory(classId, days)
}
