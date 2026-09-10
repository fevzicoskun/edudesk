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

/** 'YYYY-MM-DD' tarihine gün ekler/çıkarır. Saf takvim aritmetiği (UTC) — saat dilimi/DST günü kaydıramaz. */
export function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

// Verilen andaki saat dilimi ofseti (ms): o bölgenin duvar saati − UTC.
function tzOffsetMs(instant: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(instant))
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find(p => p.type === type)?.value)
  const wallAsUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'))
  return wallAsUtc - Math.floor(instant / 1000) * 1000
}

/** İstanbul duvar saatini ('YYYY-MM-DD' + 'HH:MM') UTC anına çevirir. Sabit +3 varsaymaz; Intl tz verisini kullanır
 *  (ofset değişim sınırı için iki geçiş). Sunucunun kendi saat diliminden bağımsızdır. */
export function istanbulLocalToUtc(date: string, time: string): Date {
  const [y, m, d] = date.split('-').map(Number)
  const [hh, mm] = time.split(':').map(Number)
  const wallAsUtc = Date.UTC(y, m - 1, d, hh, mm)
  const firstGuess = wallAsUtc - tzOffsetMs(wallAsUtc, 'Europe/Istanbul')
  return new Date(wallAsUtc - tzOffsetMs(firstGuess, 'Europe/Istanbul'))
}

/** Türkiye saatine göre bugünün haftagünü: 1=Pazartesi … 7=Pazar (Cmt/Paz = hafta sonu).
 *  Intl ile doğrudan çözülür; UTC sunucuda gece yarısı kayması olmaz. */
export function todayWeekdayTR(): number {
  const wd = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Istanbul', weekday: 'short' }).format(new Date())
  return ({ Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 } as Record<string, number>)[wd] ?? 0
}
