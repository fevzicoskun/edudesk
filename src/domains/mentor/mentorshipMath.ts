import { todayLocalISO } from '@/src/shared/date'

/** Bir öğrenciyle en son ne zaman görüşüldüğünü gün cinsinden verir.
 *  `todayLocalISO()` İstanbul yerel gününü kullanır — UTC sunucularda
 *  gece yarısına yakın saatlerde gün kaymasına düşmemek için Date.now()
 *  yerine bunu kullanmak şart. */
export function gunFarki(dateISO: string): number {
  const bugun = new Date(todayLocalISO() + 'T00:00:00').getTime()
  const o = new Date(dateISO + 'T00:00:00').getTime()
  return Math.round((bugun - o) / 86_400_000)
}
