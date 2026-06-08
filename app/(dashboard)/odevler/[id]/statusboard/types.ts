import type { SubmissionStatus } from '@/src/shared/types'

export type StatusItem = {
  student_id: string
  full_name: string
  student_number: string | null
  status: SubmissionStatus
  note: string | null
  hasRecord: boolean
  missedCount: number
  totalHomeworks: number
  veli_telefon: string | null
  veli_ad: string | null
  veli_email: string | null
}

export const STATUS_OPTIONS: SubmissionStatus[] = ['yapildi', 'eksik', 'yapilmadi', 'gec', 'mazeretli']

export const BULK_OPTIONS: SubmissionStatus[] = ['yapildi', 'yapilmadi', 'eksik']

// Mobil döngü sırası: default (yapilmadi) → 1 dokunuş = yapildi (en sık istenen)
export const MOBILE_CYCLE: SubmissionStatus[] = ['yapilmadi', 'yapildi', 'eksik', 'gec', 'mazeretli']

export const LABELS: Record<SubmissionStatus, string> = {
  yapildi: 'Yapıldı', eksik: 'Eksik', yapilmadi: 'Yapılmadı', gec: 'Geç', mazeretli: 'Mazeretli',
}

export const STYLES: Record<SubmissionStatus, string> = {
  yapildi:   'bg-green-100 text-green-700 border-green-200',
  eksik:     'bg-yellow-100 text-yellow-700 border-yellow-200',
  yapilmadi: 'bg-red-100 text-red-700 border-red-200',
  gec:       'bg-orange-100 text-orange-700 border-orange-200',
  mazeretli: 'bg-slate-100 text-slate-700 border-slate-200',
}

export const BAR_COLORS: Record<SubmissionStatus, string> = {
  yapildi:   'bg-emerald-500',
  eksik:     'bg-amber-400',
  yapilmadi: 'bg-red-400',
  gec:       'bg-orange-400',
  mazeretli: 'bg-slate-300',
}

export const STYLE_TEXT: Record<SubmissionStatus, string> = {
  yapildi:   'text-green-600 dark:text-green-400',
  eksik:     'text-yellow-600 dark:text-yellow-400',
  yapilmadi: 'text-red-600 dark:text-red-400',
  gec:       'text-orange-500 dark:text-orange-400',
  mazeretli: 'text-slate-500 dark:text-slate-400',
}

export function relativeTime(iso: string): string {
  const diffMs   = Date.now() - new Date(iso).getTime()
  const diffMins = Math.floor(diffMs / 60_000)
  if (diffMins < 1)  return 'Az önce'
  if (diffMins < 60) return `${diffMins} dk önce`
  const diffH = Math.floor(diffMins / 60)
  if (diffH < 24)    return `${diffH} sa önce`
  const diffD = Math.floor(diffH / 24)
  if (diffD === 1)   return 'Dün'
  if (diffD < 7)     return `${diffD} gün önce`
  const d = new Date(iso)
  return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`
}

export function nextInCycle(s: SubmissionStatus): SubmissionStatus {
  const idx = MOBILE_CYCLE.indexOf(s)
  return MOBILE_CYCLE[(idx + 1) % MOBILE_CYCLE.length]
}
