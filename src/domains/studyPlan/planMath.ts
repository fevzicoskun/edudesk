// Haftalık çalışma planı — saf mantık. Tarihler 'YYYY-MM-DD' string; TZ'siz UTC aritmetiği.

export type PlanStatus = 'planlandi' | 'yapildi' | 'eksik' | 'yapilmadi'
export const PLAN_STATUSES: readonly PlanStatus[] = ['planlandi', 'yapildi', 'eksik', 'yapilmadi']
export const PLAN_STATUS_LABELS: Record<PlanStatus, string> = {
  planlandi: 'Planlandı', yapildi: 'Yapıldı', eksik: 'Eksik', yapilmadi: 'Yapılmadı',
}
export const DAY_LABELS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'] as const
const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']

const MS_DAY = 86_400_000

function toUTC(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}
function toISO(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}
/** 0=Pzt … 6=Paz */
function dayIndex(iso: string): number {
  return (new Date(toUTC(iso)).getUTCDay() + 6) % 7
}

export function weekStartOf(iso: string): string {
  return toISO(toUTC(iso) - dayIndex(iso) * MS_DAY)
}
export function shiftWeek(weekStart: string, delta: number): string {
  return toISO(toUTC(weekStart) + delta * 7 * MS_DAY)
}
export function weekDays(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, i) => toISO(toUTC(weekStart) + i * MS_DAY))
}
export function isInWeek(iso: string, weekStart: string): boolean {
  const diff = (toUTC(iso) - toUTC(weekStart)) / MS_DAY
  return diff >= 0 && diff <= 6
}
export function dayLabel(iso: string | null): string {
  return iso ? DAY_LABELS[dayIndex(iso)] : 'Hafta'
}
export function formatWeekLabel(weekStart: string): string {
  const a = new Date(toUTC(weekStart)), b = new Date(toUTC(weekStart) + 6 * MS_DAY)
  const da = a.getUTCDate(), db = b.getUTCDate()
  const ma = MONTHS[a.getUTCMonth()], mb = MONTHS[b.getUTCMonth()]
  const ya = a.getUTCFullYear(), yb = b.getUTCFullYear()
  if (ya !== yb) return `${da} ${ma} ${ya} – ${db} ${mb} ${yb}`
  if (ma !== mb) return `${da} ${ma} – ${db} ${mb} ${ya}`
  return `${da} – ${db} ${ma} ${ya}`
}

export interface CopySource {
  plan_date: string | null
  source: string | null
  description: string
  subject: string
}
export interface CopiedItem extends CopySource {
  status: 'planlandi'
  note: null
}
/** Önceki haftanın maddelerini yeni haftaya taşır: aynı haftagünü, durum/not sıfır. */
export function copyWeek<T extends CopySource>(items: T[], fromWeek: string, toWeek: string): CopiedItem[] {
  const offset = toUTC(toWeek) - toUTC(fromWeek)
  return items.map(i => ({
    plan_date: i.plan_date ? toISO(toUTC(i.plan_date) + offset) : null,
    source: i.source,
    description: i.description,
    subject: i.subject,
    status: 'planlandi',
    note: null,
  }))
}

export interface WeekSummary { toplam: number; yapildi: number; eksik: number; yapilmadi: number; yuzde: number }
export function weekSummary(items: { status: PlanStatus }[]): WeekSummary {
  const s = { toplam: items.length, yapildi: 0, eksik: 0, yapilmadi: 0, yuzde: 0 }
  for (const i of items) {
    if (i.status === 'yapildi') s.yapildi++
    else if (i.status === 'eksik') s.eksik++
    else if (i.status === 'yapilmadi') s.yapilmadi++
  }
  s.yuzde = s.toplam ? Math.round((s.yapildi / s.toplam) * 100) : 0
  return s
}

export function groupBySubject<T extends { subject: string }>(items: T[]): { subject: string; items: T[] }[] {
  const map = new Map<string, T[]>()
  for (const i of items) {
    const arr = map.get(i.subject)
    if (arr) arr.push(i); else map.set(i.subject, [i])
  }
  return [...map.entries()].map(([subject, items]) => ({ subject, items }))
}
