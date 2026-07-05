import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/src/shared/auth'
import { CalendarService } from '@/src/domains/calendar/services/CalendarService'
import { parseAyParam, buildMonthCells, toDateStr } from '@/src/domains/calendar/calendarMath'
import TakvimClient from './TakvimClient'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Takvim' }

export default async function TakvimPage({ searchParams }: { searchParams: Promise<{ ay?: string }> }) {
  const profile = await getCurrentProfile()
  if (!profile?.school_id) redirect('/login')

  const { ay } = await searchParams
  const today = new Date()
  const { year, month } = parseAyParam(ay, today)

  const { days, canManage } = await CalendarService.getMonth(year, month)
  const cells = buildMonthCells(year, month)

  const prev = month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 }
  const next = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <TakvimClient
        year={year}
        month={month}
        cells={cells}
        days={days}
        canManage={canManage}
        todayStr={toDateStr(today.getFullYear(), today.getMonth() + 1, today.getDate())}
        prevHref={`/takvim?ay=${prev.year}-${String(prev.month).padStart(2, '0')}`}
        nextHref={`/takvim?ay=${next.year}-${String(next.month).padStart(2, '0')}`}
      />
    </div>
  )
}
