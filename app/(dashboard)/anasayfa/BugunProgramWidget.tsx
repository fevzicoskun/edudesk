import Link from 'next/link'
import { ScheduleService } from '@/src/domains/schedule/services/ScheduleService'
import { todaysLessons } from '@/src/domains/schedule/scheduleMath'
import { todayWeekdayTR } from '@/src/shared/date'
import { classColor } from '@/src/domains/schedule/classColor'

// Öğretmen anasayfasında "bugün hangi derslerim var" şeridi. Tam haftalık ızgara
// /ders-programi'de; burada yalnız bugünün dersleri, ızgarayla aynı sınıf renkleriyle.
export default async function BugunProgramWidget() {
  let data
  try {
    data = await ScheduleService.getMySchedule()
  } catch {
    return null // program okunamazsa dashboard'ı bozma
  }
  const { periods, slots, classes } = data
  if (slots.length === 0) return null // program kurulmamış → dashboard'ı kalabalıklaştırma

  const nameById = new Map(classes.map(c => [c.id, c.name]))
  // İstanbul haftagünü (1=Pzt..5=Cum, slot'lar hafta içi) — UTC getDay() gece kayar
  const lessons = todaysLessons(slots, periods, todayWeekdayTR())

  return (
    <section className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4 mb-4">
      <header className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300">Bugünkü Programım</h2>
        <Link href="/ders-programi" className="text-xs text-blue-600 font-medium hover:underline">
          Tüm hafta →
        </Link>
      </header>
      {lessons.length > 0 ? (
        <ol className="flex flex-wrap gap-2">
          {lessons.map(l => (
            <li
              key={l.period}
              className={`rounded-lg ring-1 px-3 py-2 min-w-[96px] ${classColor(nameById.get(l.classId) ?? l.classId)}`}
            >
              <div className="text-[11px] opacity-90 tabular-nums">
                {l.period}. ders · {l.start}
              </div>
              <div className="font-semibold leading-tight">{nameById.get(l.classId) ?? '—'}</div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-gray-500 dark:text-slate-400">Bugün dersin görünmüyor.</p>
      )}
    </section>
  )
}
