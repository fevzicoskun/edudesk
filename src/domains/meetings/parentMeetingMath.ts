import type { Period, Slot } from '@/src/domains/schedule/scheduleMath'

export type MeetingStatus = 'planlandi' | 'yapildi' | 'iptal'

// 'YYYY-MM-DD' → 1=Pazartesi .. 7=Pazar. UTC tabanlı (yerel saat dilimi etkilemesin).
export function weekdayFromDate(isoDate: string): number {
  const js = new Date(`${isoDate}T00:00:00Z`).getUTCDay() // 0=Pazar .. 6=Cumartesi
  return js === 0 ? 7 : js
}

// Seçilen güne ait müsait periyotlar: ders programında dolu olmayan + rezerve olmayan.
// Hafta sonu (weekday ∉ 1..5) → boş.
export function freePeriods(
  slots: Slot[],
  periods: Period[],
  weekday: number,
  bookedPeriods: number[],
): Period[] {
  if (weekday < 1 || weekday > 5) return []
  const taken = new Set<number>([
    ...slots.filter(s => s.day === weekday).map(s => s.period),
    ...bookedPeriods,
  ])
  return periods.filter(p => !taken.has(p.no))
}
