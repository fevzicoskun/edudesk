import { requireAbility } from '@/src/shared/authorization/server'
import { getCurrentProfile } from '@/src/shared/auth'
import { P } from '@/src/shared/permissions'
import { logger } from '@/src/infrastructure/observability/logger'
import { StudyPlanRepository } from '../repositories/StudyPlanRepository'
import { copyWeek, isInWeek, shiftWeek, type PlanStatus } from '../planMath'

export interface PlanItem {
  id: string; student_id: string; teacher_id: string; subject: string
  week_start: string; plan_date: string | null; source: string | null
  description: string; status: PlanStatus; note: string | null
}
export interface PlanItemWithTeacher extends PlanItem { teacher_name: string }
export interface StudentSource { id: string; name: string; subject: string }
export interface StudentPlanRow { id: string; full_name: string; student_number: string | null; items: PlanItem[] }

const YETKI_YOK = 'Bu işlem için yetkiniz yok.'
const SINIF_DISI = 'Bu öğrencinin sınıfına atanmış değilsiniz.'
const KENDI_DEGIL = 'Madde bulunamadı veya size ait değil.'

// Yazma kapısı: izin + öğrencinin sınıfı öğretmene atanmış olmalı (müdür de dahil — v1 bilinçli).
async function writeGate(studentId: string, perm: typeof P.HOMEWORK.CREATE) {
  const ability = await requireAbility()
  if (ability.cannot(perm)) return { error: YETKI_YOK } as const
  const { data, error } = await StudyPlanRepository.studentClassId(studentId, ability.schoolId)
  if (error) {
    logger.error({ event: 'plan_student_lookup_failed', userId: ability.userId, err: error.message }, 'Öğrenci sınıfı okunamadı')
    return { error: 'Öğrenci bulunamadı.' } as const
  }
  if (!data) return { error: 'Öğrenci bulunamadı.' } as const
  if (!(await StudyPlanRepository.isTeacherOfClass(ability.userId, data.class_id))) return { error: SINIF_DISI } as const
  return { ability, classId: data.class_id } as const
}

async function currentSubject(): Promise<string> {
  const profile = await getCurrentProfile()
  return profile?.subject?.trim() || 'Genel'
}

export const StudyPlanService = {
  async getClassWeek(classId: string, weekStart: string): Promise<{ students: StudentPlanRow[]; error?: string }> {
    const ability = await requireAbility()
    if (ability.cannot(P.HOMEWORK.READ)) return { students: [], error: YETKI_YOK }
    if (!(await StudyPlanRepository.isTeacherOfClass(ability.userId, classId))) return { students: [], error: 'Bu sınıfa atanmış değilsiniz.' }
    const studentsRes = await StudyPlanRepository.listStudentsOfClass(classId, ability.schoolId)
    if (studentsRes.error) {
      logger.error({ event: 'plan_students_failed', userId: ability.userId, err: studentsRes.error.message }, 'Plan öğrenci listesi hatası')
      return { students: [], error: 'Öğrenciler yüklenemedi.' }
    }
    const students = studentsRes.data ?? []
    const itemsRes = await StudyPlanRepository.listTeacherItems(ability.userId, ability.schoolId, weekStart, students.map(s => s.id))
    if (itemsRes.error) {
      logger.error({ event: 'plan_items_failed', userId: ability.userId, err: itemsRes.error.message }, 'Plan maddeleri hatası')
      return { students: [], error: 'Plan yüklenemedi.' }
    }
    const byStudent = new Map<string, PlanItem[]>()
    for (const raw of itemsRes.data ?? []) {
      const it = raw as PlanItem
      const arr = byStudent.get(it.student_id)
      if (arr) arr.push(it); else byStudent.set(it.student_id, [it])
    }
    return { students: students.map(s => ({ ...s, items: byStudent.get(s.id) ?? [] })) }
  },

  async getStudentWeek(studentId: string, weekStart: string): Promise<{ items: PlanItemWithTeacher[]; error?: string }> {
    const ability = await requireAbility()
    if (ability.cannot(P.HOMEWORK.READ)) return { items: [], error: YETKI_YOK }
    const { data, error } = await StudyPlanRepository.listStudentItems(studentId, ability.schoolId, weekStart)
    if (error) {
      logger.error({ event: 'plan_student_items_failed', userId: ability.userId, err: error.message }, 'Öğrenci plan hatası')
      return { items: [], error: 'Plan yüklenemedi.' }
    }
    type Raw = PlanItem & { profiles: { full_name: string } | null }
    return { items: ((data ?? []) as Raw[]).map(({ profiles, ...it }) => ({ ...it, teacher_name: profiles?.full_name ?? 'Öğretmen' })) }
  },

  async getSources(studentId: string): Promise<StudentSource[]> {
    const ability = await requireAbility()
    const { data, error } = await StudyPlanRepository.listSources(studentId, ability.schoolId)
    if (error) {
      logger.error({ event: 'plan_sources_failed', userId: ability.userId, err: error.message }, 'Kaynak defteri hatası')
      return []
    }
    return data ?? []
  },

  async canWriteFor(studentId: string): Promise<boolean> {
    const gate = await writeGate(studentId, P.HOMEWORK.CREATE)
    return !('error' in gate)
  },

  async addSource(studentId: string, name: string): Promise<{ error?: string; id?: string }> {
    const gate = await writeGate(studentId, P.HOMEWORK.CREATE)
    if ('error' in gate) return { error: gate.error }
    const { data, error } = await StudyPlanRepository.insertSource({
      school_id: gate.ability.schoolId, student_id: studentId, subject: await currentSubject(), name, created_by: gate.ability.userId,
    })
    if (error || !data) {
      logger.error({ event: 'plan_source_insert_failed', userId: gate.ability.userId, err: error?.message }, 'Kaynak ekleme hatası')
      return { error: 'Kaynak eklenemedi.' }
    }
    return { id: data.id }
  },

  async removeSource(id: string): Promise<{ error?: string }> {
    const ability = await requireAbility()
    if (ability.cannot(P.HOMEWORK.DELETE)) return { error: YETKI_YOK }
    const { data, error } = await StudyPlanRepository.deactivateSource(id, ability.schoolId)
    if (error) {
      logger.error({ event: 'plan_source_delete_failed', userId: ability.userId, err: error.message }, 'Kaynak silme hatası')
      return { error: 'Kaynak silinemedi.' }
    }
    if (!data?.length) return { error: 'Kaynak bulunamadı.' }
    return {}
  },

  async addItem(input: { studentId: string; weekStart: string; planDate: string | null; source: string | null; description: string }): Promise<{ error?: string; id?: string }> {
    if (input.planDate && !isInWeek(input.planDate, input.weekStart)) return { error: 'Gün seçilen haftanın içinde olmalı.' }
    const gate = await writeGate(input.studentId, P.HOMEWORK.CREATE)
    if ('error' in gate) return { error: gate.error }
    const { data, error } = await StudyPlanRepository.insertItems([{
      school_id: gate.ability.schoolId, student_id: input.studentId, teacher_id: gate.ability.userId,
      subject: await currentSubject(), week_start: input.weekStart, plan_date: input.planDate,
      source: input.source, description: input.description, status: 'planlandi', note: null,
    }])
    if (error || !data?.length) {
      logger.error({ event: 'plan_item_insert_failed', userId: gate.ability.userId, err: error?.message }, 'Plan maddesi ekleme hatası')
      return { error: 'Madde eklenemedi.' }
    }
    return { id: data[0].id }
  },

  async updateItem(id: string, patch: { description?: string; source?: string | null; planDate?: string | null; status?: PlanStatus; note?: string | null }): Promise<{ error?: string }> {
    const ability = await requireAbility()
    if (ability.cannot(P.HOMEWORK.UPDATE)) return { error: YETKI_YOK }
    const { planDate, ...rest } = patch
    const dbPatch = planDate === undefined ? rest : { ...rest, plan_date: planDate }
    const { data, error } = await StudyPlanRepository.updateItem(id, ability.userId, ability.schoolId, dbPatch)
    if (error) {
      // 23514 = check ihlali (gün hafta dışı vb.)
      if (error.code === '23514') return { error: 'Gün seçilen haftanın içinde olmalı.' }
      logger.error({ event: 'plan_item_update_failed', userId: ability.userId, err: error.message }, 'Plan maddesi güncelleme hatası')
      return { error: 'Madde güncellenemedi.' }
    }
    if (!data?.length) return { error: KENDI_DEGIL }
    return {}
  },

  async deleteItem(id: string): Promise<{ error?: string }> {
    const ability = await requireAbility()
    if (ability.cannot(P.HOMEWORK.DELETE)) return { error: YETKI_YOK }
    const { data, error } = await StudyPlanRepository.deleteItem(id, ability.userId, ability.schoolId)
    if (error) {
      logger.error({ event: 'plan_item_delete_failed', userId: ability.userId, err: error.message }, 'Plan maddesi silme hatası')
      return { error: 'Madde silinemedi.' }
    }
    if (!data?.length) return { error: KENDI_DEGIL }
    return {}
  },

  async copyPreviousWeek(studentId: string, weekStart: string): Promise<{ error?: string; count?: number }> {
    const gate = await writeGate(studentId, P.HOMEWORK.CREATE)
    if ('error' in gate) return { error: gate.error }
    const { ability } = gate
    const target = await StudyPlanRepository.listTeacherItems(ability.userId, ability.schoolId, weekStart, [studentId])
    if (target.error) return { error: 'Plan yüklenemedi.' }
    if (target.data?.length) return { error: 'Bu hafta boş değil.' }
    const prevWeek = shiftWeek(weekStart, -1)
    const prev = await StudyPlanRepository.listTeacherItems(ability.userId, ability.schoolId, prevWeek, [studentId])
    if (prev.error) return { error: 'Plan yüklenemedi.' }
    if (!prev.data?.length) return { error: 'Geçen hafta plan yok.' }
    const copies = copyWeek(prev.data ?? [], prevWeek, weekStart)
    const { data, error } = await StudyPlanRepository.insertItems(copies.map(c => ({
      ...c, school_id: ability.schoolId, student_id: studentId, teacher_id: ability.userId, week_start: weekStart,
    })))
    if (error) {
      logger.error({ event: 'plan_copy_failed', userId: ability.userId, err: error.message }, 'Plan kopyalama hatası')
      return { error: 'Kopyalanamadı.' }
    }
    return { count: data?.length ?? 0 }
  },
}
