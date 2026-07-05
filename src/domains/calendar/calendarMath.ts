// Takvim birleştirme çekirdeği — saf fonksiyonlar, DB/IO yok.
// Tarih konvansiyonu: her yerde 'YYYY-MM-DD' string; Date yalnız yerel y/m/d ile kurulur (tz güvenli).

export type CalendarEventType = 'tatil' | 'etkinlik' | 'nobet' | 'randevu' | 'odev'

export interface CalendarEvent {
  date: string
  type: CalendarEventType
  title: string
  detail?: string
  id?: string // yalnız etkinlik (silme için)
}

export interface MonthCell {
  date: string
  day: number
  inMonth: boolean
}

export interface DutyInput {
  day_of_week: number // 1=Pazartesi .. 5=Cuma (dutyMath konvansiyonu)
  time_range: string
  location: string
  teacherName?: string
}

const TYPE_ORDER: Record<CalendarEventType, number> = {
  tatil: 0, etkinlik: 1, nobet: 2, randevu: 3, odev: 4,
}

export function toDateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function parseAyParam(raw: string | undefined, today: Date): { year: number; month: number } {
  const m = raw?.match(/^(\d{4})-(\d{2})$/)
  if (m) {
    const year = Number(m[1])
    const month = Number(m[2])
    if (month >= 1 && month <= 12) return { year, month }
  }
  return { year: today.getFullYear(), month: today.getMonth() + 1 }
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

// JS getDay (0=Pazar) → 1=Pazartesi..7=Pazar
function dowTr(year: number, month: number, day: number): number {
  return ((new Date(year, month - 1, day).getDay() + 6) % 7) + 1
}

export function buildMonthCells(year: number, month: number): MonthCell[] {
  const total = daysInMonth(year, month)
  const cells: MonthCell[] = []

  // Önde dolgu: ayın 1'i Pazartesi değilse önceki ayın taşan günleri.
  const lead = dowTr(year, month, 1) - 1
  for (let i = lead; i > 0; i--) {
    const d = new Date(year, month - 1, 1 - i)
    cells.push({ date: toDateStr(d.getFullYear(), d.getMonth() + 1, d.getDate()), day: d.getDate(), inMonth: false })
  }

  for (let day = 1; day <= total; day++) {
    cells.push({ date: toDateStr(year, month, day), day, inMonth: true })
  }

  // Arkada dolgu: son haftayı 7'ye tamamla.
  const trail = (7 - (cells.length % 7)) % 7
  for (let i = 1; i <= trail; i++) {
    const d = new Date(year, month - 1, total + i)
    cells.push({ date: toDateStr(d.getFullYear(), d.getMonth() + 1, d.getDate()), day: d.getDate(), inMonth: false })
  }

  return cells
}

export function expandDuties(
  duties: DutyInput[],
  year: number,
  month: number,
  holidayDates: Set<string>
): CalendarEvent[] {
  const valid = duties.filter(d => Number.isInteger(d.day_of_week) && d.day_of_week >= 1 && d.day_of_week <= 5)
  const total = daysInMonth(year, month)
  const events: CalendarEvent[] = []

  for (let day = 1; day <= total; day++) {
    const dow = dowTr(year, month, day)
    if (dow > 5) continue
    const date = toDateStr(year, month, day)
    if (holidayDates.has(date)) continue
    for (const duty of valid) {
      if (duty.day_of_week !== dow) continue
      const suffix = duty.teacherName ? ` (${duty.teacherName})` : ''
      events.push({ date, type: 'nobet', title: `Nöbet — ${duty.location}${suffix}`, detail: duty.time_range })
    }
  }
  return events
}

export function groupByDay(events: CalendarEvent[]): Record<string, CalendarEvent[]> {
  const grouped: Record<string, CalendarEvent[]> = {}
  for (const e of events) {
    ;(grouped[e.date] ??= []).push(e)
  }
  for (const date of Object.keys(grouped)) {
    grouped[date].sort((a, b) => TYPE_ORDER[a.type] - TYPE_ORDER[b.type])
  }
  return grouped
}
