import {
  format as dfFormat,
  formatDistanceToNow as dfFormatDistanceToNow,
  parseISO,
  isPast,
  isThisWeek,
  subDays,
  addDays,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  eachDayOfInterval,
  getDay,
  isSameDay,
  isToday,
  addMonths,
  subMonths,
} from 'date-fns'
import { tr } from 'date-fns/locale'

type FormatArgs = Parameters<typeof dfFormat>
type FormatDistanceArgs = Parameters<typeof dfFormatDistanceToNow>

export function format(date: FormatArgs[0], formatStr: FormatArgs[1], options?: FormatArgs[2]) {
  return dfFormat(date, formatStr, { locale: tr, ...options })
}

export function formatDistanceToNow(date: FormatDistanceArgs[0], options?: FormatDistanceArgs[1]) {
  return dfFormatDistanceToNow(date, { locale: tr, ...options })
}

export {
  parseISO,
  isPast,
  isThisWeek,
  subDays,
  addDays,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  eachDayOfInterval,
  getDay,
  isSameDay,
  isToday,
  addMonths,
  subMonths,
}

/** Türkiye (Europe/Istanbul) yerel tarihi YYYY-MM-DD formatında döndürür.
 *  Vercel gibi UTC sunucularda da doğru çalışır. */
export function todayLocalISO(): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Istanbul' }).format(new Date())
}
