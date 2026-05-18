'use server'

import { revalidatePath } from 'next/cache'
import { UUID, saveAttendanceSchema } from '@/lib/validation'
import { AttendanceService } from '../services/AttendanceService'
import type { AttendanceStatus } from '../types'

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
  UUID.parse(classId)
  return AttendanceService.getAttendanceForDate(classId, date)
}

export async function getAttendanceHistory(classId: string, days = 14) {
  UUID.parse(classId)
  return AttendanceService.getAttendanceHistory(classId, days)
}
