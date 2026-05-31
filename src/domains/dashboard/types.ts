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
  newRiskCount: number
}

export type OdevTamamlanmaItem = {
  title:   string
  yapildi: number
  eksik:   number
  diger:   number
}

export type YoklamaTrendItem = {
  hafta:    string
  oran:     number
  devamsiz: number
  toplam:   number
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
  yoklamaTrendData: YoklamaTrendItem[]
  yoklamaDurumu: YoklamaDurumItem[]
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
