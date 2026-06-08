import type { SubmissionStatus } from '@/src/shared/types'
import { format, parseISO } from '@/src/shared/date'

export type Student  = { id: string; full_name: string; student_number: string | null }
export type Homework = { id: string; title: string; subject: string; due_date: string | null }

export type MatrisProps = {
  students:   Student[]
  homeworks:  Homework[]
  subMap:     Record<string, SubmissionStatus>
  className?: string
}

export type StatEntry = { done: number; eligible: number; pct: number | null }

export const STATUS_LABEL: Record<SubmissionStatus, string> = {
  yapildi: 'Yapıldı', eksik: 'Eksik', yapilmadi: 'Yapılmadı', gec: 'Geç', mazeretli: 'Mazeretli',
}

export const CELL_CLS: Record<SubmissionStatus, string> = {
  yapildi:   'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400',
  eksik:     'bg-amber-100  text-amber-700  dark:bg-amber-900/40  dark:text-amber-400',
  yapilmadi: 'bg-red-100    text-red-700    dark:bg-red-900/40    dark:text-red-400',
  gec:       'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400',
  mazeretli: 'bg-slate-100  text-slate-600  dark:bg-slate-700     dark:text-slate-400',
}

export const CELL_DOT: Record<SubmissionStatus, string> = {
  yapildi: '✓', eksik: '~', yapilmadi: '✗', gec: 'G', mazeretli: 'M',
}

export const STATUS_COLOR: Record<SubmissionStatus, string> = {
  yapildi:   'FFD9EAD3',
  eksik:     'FFFFFF99',
  yapilmadi: 'FFFFE2DD',
  gec:       'FFFFF0E0',
  mazeretli: 'FFF3F3F3',
}

export const PDF_COLOR: Record<SubmissionStatus, [number, number, number]> = {
  yapildi:   [217, 234, 211],
  eksik:     [255, 255, 153],
  yapilmadi: [255, 226, 221],
  gec:       [255, 240, 224],
  mazeretli: [243, 243, 243],
}

export function dueDateFmt(d: string | null) {
  if (!d) return '—'
  try { return format(parseISO(d), 'd MMM') } catch { return d }
}

export function completionColor(pct: number) {
  if (pct >= 80) return 'text-emerald-600 dark:text-emerald-400'
  if (pct >= 50) return 'text-amber-600 dark:text-amber-400'
  return 'text-red-500 dark:text-red-400'
}
