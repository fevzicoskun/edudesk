import { requireAbility } from '@/src/shared/authorization/server'
import { logger } from '@/src/infrastructure/observability/logger'
import { TaskRepository } from '../repositories/TaskRepository'
import {
  isVisibleToday, isOverdue, snoozeDate, todayStr, validateTaskTitle, type TaskRow,
} from '../taskMath'

export interface Task extends TaskRow {
  created_at: string
  overdue: boolean
}

type Row = TaskRow & { created_at: string }

function decorate(rows: Row[]): Task[] {
  const today = todayStr()
  return rows
    .filter(r => isVisibleToday(r, today))
    .map(r => ({ ...r, overdue: isOverdue(r, today) }))
}

export const TaskService = {
  // Bugün görünür açık görevlerim.
  async getMyActiveTasks(): Promise<Task[]> {
    const ability = await requireAbility()
    const { data, error } = await TaskRepository.listOpenForUser(ability.userId, ability.schoolId)
    if (error) {
      logger.error({ event: 'task_list_failed', userId: ability.userId, err: error.message }, 'Görev listesi okuma hatası')
      return []
    }
    return decorate((data ?? []) as Row[])
  },

  // Bir öğrencinin açık görevleri (profil yüzeyi). Erteleme filtresi uygulanmaz: profilde hepsi görünür.
  async getStudentTasks(studentId: string): Promise<Task[]> {
    const ability = await requireAbility()
    const { data, error } = await TaskRepository.listOpenForStudent(ability.userId, ability.schoolId, studentId)
    if (error) {
      logger.error({ event: 'task_student_list_failed', userId: ability.userId, err: error.message }, 'Öğrenci görev listesi hatası')
      return []
    }
    const today = todayStr()
    return ((data ?? []) as Row[]).map(r => ({ ...r, overdue: isOverdue(r, today) }))
  },

  async addTask(input: {
    title: string
    studentId?: string | null
    classId?: string | null
    dueDate?: string | null
  }): Promise<{ error?: string; task?: Task }> {
    const ability = await requireAbility()

    const vErr = validateTaskTitle(input.title)
    if (vErr) return { error: vErr }

    const { data, error } = await TaskRepository.insert({
      user_id: ability.userId,
      school_id: ability.schoolId,
      title: input.title.trim(),
      student_id: input.studentId ?? null,
      class_id: input.classId ?? null,
      due_date: input.dueDate ?? null,
    })
    if (error || !data) {
      logger.error({ event: 'task_add_failed', userId: ability.userId, err: error?.message }, 'Görev ekleme hatası')
      return { error: 'Görev kaydedilemedi' }
    }
    const today = todayStr()
    return { task: { ...(data as Row), overdue: isOverdue(data as Row, today) } }
  },

  async completeTask(id: string): Promise<{ error?: string }> {
    const ability = await requireAbility()
    const { error } = await TaskRepository.setDone(id, ability.userId, true)
    if (error) {
      logger.error({ event: 'task_complete_failed', userId: ability.userId, err: error.message }, 'Görev tamamlama hatası')
      return { error: 'Görev güncellenemedi' }
    }
    return {}
  },

  async reopenTask(id: string): Promise<{ error?: string }> {
    const ability = await requireAbility()
    const { error } = await TaskRepository.setDone(id, ability.userId, false)
    if (error) {
      logger.error({ event: 'task_reopen_failed', userId: ability.userId, err: error.message }, 'Görev geri-açma hatası')
      return { error: 'Görev güncellenemedi' }
    }
    return {}
  },

  async snoozeTask(id: string, option: 'tomorrow' | 'nextWeek'): Promise<{ error?: string }> {
    const ability = await requireAbility()
    const { error } = await TaskRepository.setSnooze(id, ability.userId, snoozeDate(new Date(), option))
    if (error) {
      logger.error({ event: 'task_snooze_failed', userId: ability.userId, err: error.message }, 'Görev erteleme hatası')
      return { error: 'Görev ertelenemedi' }
    }
    return {}
  },

  async deleteTask(id: string): Promise<{ error?: string }> {
    const ability = await requireAbility()
    const { error } = await TaskRepository.deleteById(id, ability.userId)
    if (error) {
      logger.error({ event: 'task_delete_failed', userId: ability.userId, err: error.message }, 'Görev silme hatası')
      return { error: 'Görev silinemedi' }
    }
    return {}
  },
}
