import { AttendanceRepository } from '../repositories/AttendanceRepository'
import { getAbility } from '@/src/shared/authorization/server'
import { P } from '@/src/shared/permissions'
import type { AttendanceStatus } from '../types'

export const AttendanceService = {
  async saveAttendance(
    classId: string,
    date:    string,
    records: { studentId: string; status: AttendanceStatus }[]
  ): Promise<{ error?: string }> {
    const ability = await getAbility()
    if (!ability) return { error: 'Giriş gerekli' }
    if (ability.cannot(P.ATTENDANCE.CREATE)) return { error: 'Bu işlem için yetkiniz yok.' }

    const rows = records.map(r => ({
      teacher_id: ability.userId,
      class_id:   classId,
      student_id: r.studentId,
      date,
      status:     r.status,
      school_id:  ability.schoolId,
    }))

    const { error } = await AttendanceRepository.upsertAttendance(rows)
    return { error: error?.message }
  },

  async getAttendanceForDate(classId: string, date: string) {
    return AttendanceRepository.findByClassAndDate(classId, date)
  },

  async getAttendanceHistory(classId: string, days = 14) {
    const safeDays = Math.min(Math.max(1, days), 90)
    const since    = new Date()
    since.setDate(since.getDate() - safeDays)
    return AttendanceRepository.findHistoryByClass(classId, since.toISOString().split('T')[0])
  },
}
