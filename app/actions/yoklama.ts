'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { UUID, attendanceStatusSchema } from '@/src/shared/validation'
import { AttendanceService } from '@/src/domains/attendance/services/AttendanceService'
import type { AttendanceEntry } from '@/src/domains/attendance/services/AttendanceService'
import { getCurrentProfile } from '@/src/shared/auth'
import { YOKLAMA_LOCK_HOUR, YOKLAMA_LOCK_MINUTE } from '@/src/shared/constants/attendance'

export type { AttendanceStatus } from '@/src/domains/attendance/types'

const ISODate     = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Geçersiz tarih formatı')
const entrySchema = z.object({ studentId: UUID, status: attendanceStatusSchema })

const PRIVILEGED_ROLES = ['mudur_yardimcisi', 'mudur', 'admin']

function turkeyTime(): { dateISO: string; hour: number; minute: number } {
  const now     = new Date()
  const dateISO = new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Istanbul' }).format(now)
  const parts   = new Intl.DateTimeFormat('en', {
    timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(now)
  const hour   = parseInt(parts.find(p => p.type === 'hour')!.value)   % 24
  const minute = parseInt(parts.find(p => p.type === 'minute')!.value)
  return { dateISO, hour, minute }
}

export async function getYoklama(classId: string, date: string) {
  UUID.parse(classId)
  ISODate.parse(date)
  return AttendanceService.getYoklama(classId, date)
}

export async function saveYoklama(classId: string, date: string, entries: AttendanceEntry[]) {
  UUID.parse(classId)
  ISODate.parse(date)
  z.array(entrySchema).max(200).parse(entries)

  const profile = await getCurrentProfile()
  if (!PRIVILEGED_ROLES.includes(profile?.role ?? '')) {
    const { dateISO, hour, minute } = turkeyTime()
    if (date !== dateISO) {
      throw new Error('Geçmiş tarih yoklaması düzenlenemez. Müdür yardımcısına başvurun.')
    }
    const pastLock = hour > YOKLAMA_LOCK_HOUR || (hour === YOKLAMA_LOCK_HOUR && minute >= YOKLAMA_LOCK_MINUTE)
    if (pastLock) {
      throw new Error(
        `Yoklama düzenleme saati doldu (${YOKLAMA_LOCK_HOUR}:${String(YOKLAMA_LOCK_MINUTE).padStart(2, '0')}). Müdür yardımcısına başvurun.`
      )
    }
  }

  await AttendanceService.saveYoklama(classId, date, entries)
  revalidatePath('/yonetim')
  revalidatePath('/yoklama')
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
