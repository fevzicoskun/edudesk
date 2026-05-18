import { AttendanceRepository } from '../repositories/AttendanceRepository'
import { getCurrentProfile, requireSchoolId } from '@/src/shared/auth'
import { isTeachingRole } from '@/src/shared/types'
import { createClient } from '@/src/infrastructure/supabase/server'
import type { AttendanceStatus } from '../types'

export const AttendanceService = {
  async saveAttendance(
    classId: string,
    date: string,
    records: { studentId: string; status: AttendanceStatus }[]
  ): Promise<{ error?: string }> {
    const profile = await getCurrentProfile()
    if (!profile || !isTeachingRole(profile.role)) return { error: 'Bu işlem için yetkiniz yok.' }

    const [supabase, school_id] = await Promise.all([createClient(), requireSchoolId()])
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Giriş gerekli' }

    const rows = records.map(r => ({
      teacher_id: user.id,
      class_id: classId,
      student_id: r.studentId,
      date,
      status: r.status,
      school_id,
    }))

    const { error } = await AttendanceRepository.upsertAttendance(rows)
    return { error: error?.message }
  },

  async getAttendanceForDate(classId: string, date: string) {
    return AttendanceRepository.findByClassAndDate(classId, date)
  },

  async getAttendanceHistory(classId: string, days = 14) {
    const safeDays = Math.min(Math.max(1, days), 90)
    const since = new Date()
    since.setDate(since.getDate() - safeDays)
    const sinceStr = since.toISOString().split('T')[0]

    return AttendanceRepository.findHistoryByClass(classId, sinceStr)
  },
}
