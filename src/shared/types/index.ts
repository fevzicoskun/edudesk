export type Role = 'ogretmen' | 'zumre_baskani' | 'mudur_yardimcisi' | 'mudur'

export const ROLE_LABELS: Record<Role, string> = {
  ogretmen:         'Öğretmen',
  zumre_baskani:    'Zümre Başkanı',
  mudur_yardimcisi: 'Müdür Yardımcısı',
  mudur:            'Müdür',
}

export function isMudurOrAbove(role: Role | string | null | undefined): boolean {
  return role === 'mudur' || role === 'mudur_yardimcisi'
}

export function isYonetici(role: Role | string | null | undefined): boolean {
  return role === 'mudur' || role === 'mudur_yardimcisi' || role === 'zumre_baskani'
}

export function isTeachingRole(role: Role | string | null | undefined): boolean {
  return role === 'ogretmen' || role === 'zumre_baskani'
}

export type SubmissionStatus = 'yapildi' | 'eksik' | 'yapilmadi' | 'gec' | 'mazeretli'
export type CurriculumStatus = 'tamamlandi' | 'tekrar_gerekli' | 'eksik_kaldi'

export interface Profile {
  id: string
  full_name: string
  role: Role
  subject: string | null
  created_at: string
  schools?: { name: string } | null
}

export interface Class {
  id: string
  name: string
  grade: number
  academic_year: string
  created_at: string
}

export interface Student {
  id: string
  class_id: string
  full_name: string
  student_number: string | null
  created_at: string
}

export interface HomeworkSource {
  id: string
  teacher_id: string
  school_id: string
  name: string
  subject: string | null
  active: boolean
  created_at: string
}

export interface Homework {
  id: string
  teacher_id: string
  class_id: string
  title: string
  description: string | null
  subject: string
  assigned_date: string
  due_date: string
  source_id: string | null
  created_at: string
}

export interface HomeworkSubmission {
  id: string
  homework_id: string
  student_id: string
  status: SubmissionStatus
  note: string | null
  updated_at: string
}

export interface ZumreMeeting {
  id: string
  title: string
  meeting_date: string
  notes: string | null
  created_by: string
  created_at: string
}

export interface ExamEntry {
  id: string
  exam_id: string
  student_id: string | null
  name: string | null
  grade: number
  created_at: string
}

export interface CommonExam {
  id: string
  title: string
  exam_date: string
  subject: string
  created_by: string
  created_at: string
}

export interface CurriculumProgress {
  id: string
  teacher_id: string
  class_id: string
  outcome_id: string | null
  topic: string
  week_number: number | null
  completed: boolean
  status: CurriculumStatus
  completion_date: string | null
  created_at: string
}

export type { Resource, Action, Scope, AccessScope, GrantedPermission, PermissionRequirement } from '@/src/domains/rbac/types'

// Permission sabitleri
export { P } from '@/src/shared/permissions'
export type { PermissionKey } from '@/src/shared/permissions'

// Authorization engine
export {
  createAbility,
  can,
  cannot,
  guard,
  guardAll,
  guardAny,
  AuthorizationError,
  type Ability,
  type AuthorizationContext,
  type DenialReason,
  type DenialCode,
  type AuthorizationResult,
} from '@/src/shared/authorization'
