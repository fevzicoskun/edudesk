'use server'

import { UUID } from '@/src/shared/validation'
import { AttendanceService } from '@/src/domains/attendance/services/AttendanceService'
import type { AttendanceEntry } from '@/src/domains/attendance/services/AttendanceService'

export type { AttendanceStatus } from '@/src/domains/attendance/types'
export type { AttendanceEntry }

export async function getYoklama(classId: string, date: string) {
  UUID.parse(classId)
  return AttendanceService.getYoklama(classId, date)
}

export async function saveYoklama(classId: string, date: string, entries: AttendanceEntry[]) {
  UUID.parse(classId)
  return AttendanceService.saveYoklama(classId, date, entries)
}

export async function getCizelge(classId: string, year: number, month: number) {
  UUID.parse(classId)
  if (!Number.isInteger(year) || year < 2020 || year > 2100) throw new Error('Geçersiz yıl')
  if (!Number.isInteger(month) || month < 1 || month > 12) throw new Error('Geçersiz ay')
  return AttendanceService.getClassMonth(classId, year, month)
}

export async function getStudentAttendanceHistory(studentId: string) {
  UUID.parse(studentId)
  return AttendanceService.getStudentHistory(studentId)
}
