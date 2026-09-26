import type { SubmissionStatus } from '@/src/shared/types'
// src/domains/dashboard/types.ts
import type { RiskLevel } from './risk'

export type HomeworkLite = {
  id: string
  title: string
  subject: string
  due_date: string
  class_id: string
  classes: { name: string; grade: number } | null
}

export type WeeklyStats = {
  submittedCount: number
  avgCompletionPct: number
  activeRiskCount: number
}

export type OdevTamamlanmaItem = {
  id:        string   // homework id — /odevler/[id] linki için
  title:     string   // tam başlık (arayüz satır sonunda kırpar)
  classId:   string   // sınıf filtresi için
  className: string
  dueDate:   string   // YYYY-MM-DD
  /** Yalnız işaretli satırlar; her durum ayrı */
  sayim:     Record<SubmissionStatus, number>
  /** 0 = henüz kontrol edilmedi */
  isaretli:  number
}

export type YoklamaDurumItem = {
  classId:   string
  className: string
  grade:     number
  alindi:    boolean
}

export type DashboardMetrics = {
  todayHomeworkCount: number
  totalMissingCount: number
  activeRiskCount: number
  weekly: WeeklyStats
  homeworks: HomeworkLite[]
  tamamlanmaData: OdevTamamlanmaItem[]
  yoklamaDurumu: YoklamaDurumItem[]
  kontrolEdilenHwIds: string[]
  riskAlerts: RiskAlert[]
}

export type RiskAlert = {
  studentId: string
  studentName: string
  classId: string
  className: string
  riskLevel: RiskLevel
  reasons: string[]
  hwMisses: number
  absences: number
}

export type ClassSummary = {
  avgCompletionPct: number
  highRiskCount: number
  totalMissingCount: number
  riskyStudents: RiskAlert[]
}
