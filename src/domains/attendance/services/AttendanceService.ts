import { createClient } from '@/src/infrastructure/supabase/server'
import { inngest } from '@/src/infrastructure/inngest'
import { getAbility } from '@/src/shared/authorization/server'
import { P } from '@/src/shared/permissions'
import { logger } from '@/src/infrastructure/observability/logger'
import { schoolYearStart } from '@/src/shared/utils'
import { AttendanceRepository } from '../repositories/AttendanceRepository'
import { schoolDaysOfMonth, isWeekendISO } from '../lib/attendanceMath'
import type { PermissionKey } from '@/src/shared/authorization'
import type { AttendanceStatus } from '../types'

export interface AttendanceEntry {
  studentId: string
  status:    AttendanceStatus
}

const YONETICI_ROLLER = ['mudur', 'mudur_yardimcisi']

async function requireAbility(perm: PermissionKey) {
  const ability = await getAbility()
  if (!ability) throw new Error('Giriş gerekli')
  if (ability.cannot(perm)) throw new Error('Bu işlem için yetkiniz yok')
  return ability
}

export const AttendanceService = {
  async getYoklama(classId: string, date: string) {
    const ability = await requireAbility(P.ATTENDANCE.READ)
    const db = await createClient()
    const cls = await AttendanceRepository.findClass(db, classId, ability.schoolId)
    if (!cls) throw new Error('Sınıf bulunamadı')
    const rows = await AttendanceRepository.findByClassDate(db, classId, ability.schoolId, date)
    const map: Record<string, AttendanceStatus> = {}
    for (const r of rows) map[r.student_id] = r.status as AttendanceStatus
    return map
  },

  async saveYoklama(classId: string, date: string, entries: AttendanceEntry[]) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Geçersiz tarih formatı')
    if (isWeekendISO(date)) throw new Error('Hafta sonu için yoklama girilemez')
    const todayISO = new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Istanbul' }).format(new Date())
    if (date > todayISO) throw new Error('Gelecek tarih için yoklama girilemez')
    const ability = await requireAbility(P.ATTENDANCE.UPDATE)
    const db = await createClient()
    const cls = await AttendanceRepository.findClass(db, classId, ability.schoolId)
    if (!cls) throw new Error('Sınıf bulunamadı')

    if (entries.length > 0) {
      const { data: validStudents } = await db
        .from('students')
        .select('id')
        .eq('class_id', classId)
        .eq('school_id', ability.schoolId)
        .is('deleted_at', null)
        .in('id', entries.map(e => e.studentId))
      const validSet = new Set((validStudents ?? []).map(s => s.id))
      const invalid = entries.filter(e => !validSet.has(e.studentId))
      if (invalid.length > 0) throw new Error('Bazı öğrenciler bu sınıfa ait değil')
    }

    await AttendanceRepository.upsertEntries(db, entries.map(e => ({
      class_id:   classId,
      student_id: e.studentId,
      teacher_id: ability.userId,
      school_id:  ability.schoolId,
      date,
      status:     e.status,
    })))

    // Yalnız absent/late veli bildirimi tetikler; excused bilinçli olarak hariç
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
        logger.error(
          { classId, date, absentCount: absentIds.length, err: e instanceof Error ? e.message : String(e) },
          'saveYoklama: Inngest event gönderilemedi'
        )
      }
    }
  },

  async assertClassAccess(
    db: Awaited<ReturnType<typeof createClient>>,
    ability: { userId: string; schoolId: string },
    classId: string
  ) {
    const cls = await AttendanceRepository.findClass(db, classId, ability.schoolId)
    if (!cls) throw new Error('Sınıf bulunamadı')
    // Okul-içi tüm öğretmenler her sınıfın yoklama verisini görüntüleyebilir
    // (çizelge/yoklama UI'ı tüm sınıfları listeler). Cross-tenant koruması:
    // findClass zaten school_id ile filtreler.
    return cls
  },

  async getClassMonth(classId: string, year: number, month: number) {
    const ability = await requireAbility(P.ATTENDANCE.READ)
    const db = await createClient()
    await this.assertClassAccess(db, ability, classId)
    const days = schoolDaysOfMonth(year, month)
    if (days.length === 0) return { days, rows: [] }
    const rows = await AttendanceRepository.findClassRange(
      db, classId, ability.schoolId, days[0], days[days.length - 1]
    )
    return { days, rows }
  },

  async getStudentHistory(studentId: string) {
    const ability = await requireAbility(P.ATTENDANCE.READ)
    const db = await createClient()
    const { data: student } = await db
      .from('students')
      .select('id, class_id')
      .eq('id', studentId)
      .eq('school_id', ability.schoolId)
      .is('deleted_at', null)
      .single()
    if (!student) throw new Error('Öğrenci bulunamadı')
    if (student.class_id) {
      await this.assertClassAccess(db, ability, student.class_id)
    } else {
      // Sınıfsız öğrenciler için yalnızca yöneticiler erişebilir
      const { data: me } = await db.from('profiles').select('role').eq('id', ability.userId).eq('school_id', ability.schoolId).single()
      if (!YONETICI_ROLLER.includes(me?.role ?? '')) throw new Error('Bu öğrencinin devamsızlık geçmişine erişim yetkiniz yok')
    }
    return AttendanceRepository.findStudentHistory(db, studentId, ability.schoolId, schoolYearStart())
  },
}
