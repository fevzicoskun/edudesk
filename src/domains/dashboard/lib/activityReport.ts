import { subDays } from '@/src/shared/date'
import { ROLE_LABELS } from '@/src/shared/types'
import type { Role } from '@/src/shared/types'

export const ACTION_LABEL: Record<string, string> = {
  yoklama_kaydedildi: 'Yoklama aldı',
  odev_eklendi:       'Ödev ekledi',
  odev_guncellendi:   'Ödev güncelledi',
  not_girildi:        'Not girdi',
  dashboard_view:     'Panele girdi',
}

export type LogRow = {
  id: string
  teacher_id: string
  action: string
  meta: unknown
  created_at: string
}

export type TeacherRow = {
  id: string
  full_name: string | null
  role: string
}

export type TeacherStat = {
  id: string
  fullName: string
  role: string
  yoklamaCount: number
  odevCount: number
  totalCount: number
  lastActivity: string | null
}

export type ActivitySummary = {
  activeCount: number
  totalActivity: number
  passiveCount: number
}

export function buildTeacherStats(teachers: TeacherRow[], logs: LogRow[]): TeacherStat[] {
  const statMap = new Map<string, TeacherStat>()

  for (const t of teachers) {
    statMap.set(t.id, {
      id: t.id,
      fullName: t.full_name ?? 'Bilinmiyor',
      role: t.role,
      yoklamaCount: 0,
      odevCount: 0,
      totalCount: 0,
      lastActivity: null,
    })
  }

  for (const log of logs) {
    const stat = statMap.get(log.teacher_id)
    if (!stat) continue
    stat.totalCount++
    if (log.action === 'yoklama_kaydedildi') stat.yoklamaCount++
    if (log.action === 'odev_eklendi' || log.action === 'odev_guncellendi') stat.odevCount++
    if (!stat.lastActivity || log.created_at > stat.lastActivity) {
      stat.lastActivity = log.created_at
    }
  }

  return Array.from(statMap.values()).sort((a, b) => b.totalCount - a.totalCount)
}

export function computeSummary(teachers: TeacherRow[], logs: LogRow[]): ActivitySummary {
  const activeTeacherIds = new Set(logs.map(l => l.teacher_id))
  const teachingRoles = new Set<string>(['ogretmen', 'zumre_baskani', 'mudur_yardimcisi'])
  const teachingTeachers = teachers.filter(t => teachingRoles.has(t.role))
  return {
    activeCount:   activeTeacherIds.size,
    totalActivity: logs.length,
    passiveCount:  teachingTeachers.filter(t => !activeTeacherIds.has(t.id)).length,
  }
}

export function actionLabel(action: string): string {
  return ACTION_LABEL[action] ?? action
}

export function roleLabel(role: string): string {
  return ROLE_LABELS[role as Role] ?? role
}

export function extractTitle(meta: unknown): string | null {
  if (typeof meta !== 'object' || meta === null) return null
  const obj = meta as Record<string, unknown>
  return typeof obj.title === 'string' ? obj.title : null
}

export function nameInitials(fullName: string): string {
  return fullName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0] ?? '')
    .join('')
    .toUpperCase()
}

export function since30daysISO(): string {
  return subDays(new Date(), 30).toISOString()
}
