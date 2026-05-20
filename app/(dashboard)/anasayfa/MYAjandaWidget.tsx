import { createClient } from '@/src/infrastructure/supabase/server'
import { requireSchoolId } from '@/src/shared/auth'
import {
  format,
  startOfWeek,
  addDays,
  subDays,
  eachDayOfInterval,
  isToday,
  isSameDay,
  parseISO,
  getDay,
} from '@/src/shared/date'

const GUN_ADLARI = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']
const GUN_UZUN = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma']

export default async function MYAjandaWidget() {
  const supabase = await createClient()
  const school_id = await requireSchoolId()

  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]

  // Hafta başı (Pazartesi) ve 2 haftalık aralık
  const weekStart = startOfWeek(today, { weekStartsOn: 1 })
  const rangeEnd = addDays(weekStart, 13)
  const rangeStart = subDays(today, 7)

  const rangeStartStr = rangeStart.toISOString().split('T')[0]
  const rangeEndStr = rangeEnd.toISOString().split('T')[0]

  const [hwRes, attRes] = await Promise.all([
    supabase
      .from('homeworks')
      .select('due_date')
      .eq('school_id', school_id)
      .gte('due_date', rangeStartStr)
      .lte('due_date', rangeEndStr),
    supabase
      .from('attendance')
      .select('date, status')
      .eq('school_id', school_id)
      .gte('date', rangeStartStr)
      .lte('date', rangeEndStr),
  ])

  const homeworks = hwRes.data ?? []
  const attendance = attRes.data ?? []

  // Gün bazında veri hazırla
  // Ödev sayısı: due_date → count
  const hwByDate = new Map<string, number>()
  for (const hw of homeworks) {
    hwByDate.set(hw.due_date, (hwByDate.get(hw.due_date) ?? 0) + 1)
  }

  // Yoklama: tarih → kayıtlar
  const attByDate = new Map<string, { absent: number; total: number }>()
  for (const a of attendance) {
    const prev = attByDate.get(a.date) ?? { absent: 0, total: 0 }
    prev.total += 1
    if (a.status === 'absent') prev.absent += 1
    attByDate.set(a.date, prev)
  }

  // İş günleri (Pazartesi-Cuma) yoklama alınmamış: kayıt hiç yok
  function isWeekday(d: Date): boolean {
    const day = getDay(d) // 0=Pazar
    return day >= 1 && day <= 5
  }

  function getDayInfo(d: Date) {
    const dateStr = format(d, 'yyyy-MM-dd')
    const hwCount = hwByDate.get(dateStr) ?? 0
    const att = attByDate.get(dateStr)
    const absentCount = att?.absent ?? 0
    const noAttendance = isWeekday(d) && !att && dateStr <= todayStr
    return { dateStr, hwCount, absentCount, noAttendance }
  }

  // Takvim için görünecek günler: weekStart'tan 14 gün (2 hafta)
  // + geçen haftayı da göstermek için rangeStart'tan başlayabiliriz
  // Spec: "bu ay + gelecek haftaları gösteren statik ızgara"
  // weekStart'tan 14 gün (Pt-Cu x 2 hafta)
  const calDays = eachDayOfInterval({ start: weekStart, end: rangeEnd })

  // Bu haftanın iş günleri (Pt-Cu) için liste görünümü
  const thisWeekDays = eachDayOfInterval({
    start: weekStart,
    end: addDays(weekStart, 4), // Cuma
  })

  return (
    <section className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200 dark:border-slate-700">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300">Haftalık Takvim Özeti</h2>
        <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-0.5">
          {format(weekStart, 'd MMM')} – {format(rangeEnd, 'd MMM yyyy')}
        </p>
      </div>

      <div className="flex flex-col sm:flex-row">
        {/* Sol panel — mini takvim (sadece sm ve üstünde) */}
        <div className="hidden sm:block sm:w-72 lg:w-80 p-4 border-b sm:border-b-0 sm:border-r border-gray-100 dark:border-slate-700 shrink-0">
          {/* Ay başlığı */}
          <div className="mb-3">
            <span className="text-xs font-semibold text-gray-600 dark:text-slate-400 capitalize">
              {format(weekStart, 'MMMM yyyy')}
            </span>
          </div>

          {/* Gün başlıkları */}
          <div className="grid grid-cols-7 mb-1">
            {GUN_ADLARI.map(d => (
              <div key={d} className="text-center text-[10px] font-semibold text-gray-400 dark:text-slate-500 py-1">
                {d}
              </div>
            ))}
          </div>

          {/* Takvim ızgarası — 2 hafta */}
          <div className="grid grid-cols-7 gap-y-1">
            {calDays.map(day => {
              const { dateStr, hwCount, absentCount, noAttendance } = getDayInfo(day)
              const todayDay = isToday(day)
              const isPast = dateStr < todayStr

              return (
                <div
                  key={dateStr}
                  className={`flex flex-col items-center py-1 rounded-lg text-xs font-medium
                    ${todayDay
                      ? 'bg-blue-600 text-white'
                      : isPast
                        ? 'text-gray-400 dark:text-slate-600'
                        : 'text-gray-700 dark:text-slate-300'
                    }
                  `}
                >
                  <span>{format(day, 'd')}</span>
                  {/* Dot'lar */}
                  <div className="flex gap-0.5 mt-0.5 min-h-[6px] flex-wrap justify-center">
                    {hwCount > 0 && (
                      <span className={`w-1.5 h-1.5 rounded-full ${todayDay ? 'bg-white/80' : 'bg-blue-500'}`} />
                    )}
                    {absentCount > 0 && (
                      <span className={`w-1.5 h-1.5 rounded-full ${todayDay ? 'bg-white/80' : 'bg-red-500'}`} />
                    )}
                    {noAttendance && (
                      <span className={`w-1.5 h-1.5 rounded-full ${todayDay ? 'bg-white/80' : 'bg-amber-400'}`} />
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Renk açıklaması */}
          <div className="mt-3 pt-3 border-t border-gray-100 dark:border-slate-700 flex flex-wrap gap-x-3 gap-y-1">
            <span className="flex items-center gap-1 text-[10px] text-gray-500 dark:text-slate-400">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              Ödev teslim
            </span>
            <span className="flex items-center gap-1 text-[10px] text-gray-500 dark:text-slate-400">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
              Devamsız
            </span>
            <span className="flex items-center gap-1 text-[10px] text-gray-500 dark:text-slate-400">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              Yoklama yok
            </span>
          </div>
        </div>

        {/* Sağ panel — bu haftanın özeti */}
        <div className="flex-1 min-w-0 p-4">
          <h3 className="text-xs font-semibold text-gray-600 dark:text-slate-400 mb-3 uppercase tracking-wide">
            Bu Hafta
          </h3>

          <ul className="space-y-2">
            {thisWeekDays.map(day => {
              const { dateStr, hwCount, absentCount, noAttendance } = getDayInfo(day)
              const todayDay = isToday(day)
              const dayIndex = getDay(day) // 1=Pzt … 5=Cum
              const gunAdi = GUN_UZUN[dayIndex - 1] ?? GUN_ADLARI[dayIndex - 1]
              const dayNum = format(day, 'd MMM')

              return (
                <li
                  key={dateStr}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border ${
                    todayDay
                      ? 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30'
                      : 'border-gray-100 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-700/20'
                  }`}
                >
                  {/* Gün */}
                  <div className="w-20 shrink-0">
                    <p className={`text-xs font-semibold ${todayDay ? 'text-blue-700 dark:text-blue-300' : 'text-gray-700 dark:text-slate-300'}`}>
                      {gunAdi}
                    </p>
                    <p className="text-[10px] text-gray-400 dark:text-slate-500">{dayNum}</p>
                  </div>

                  {/* Ödev */}
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                    <span className="text-[11px] text-gray-600 dark:text-slate-400">
                      {hwCount > 0 ? `${hwCount} ödev` : <span className="text-gray-300 dark:text-slate-600">—</span>}
                    </span>
                  </div>

                  {/* Devamsız */}
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${absentCount > 0 ? 'bg-red-500' : 'bg-gray-200 dark:bg-slate-600'}`} />
                    <span className="text-[11px] text-gray-600 dark:text-slate-400">
                      {absentCount > 0 ? `${absentCount} devamsız` : <span className="text-gray-300 dark:text-slate-600">—</span>}
                    </span>
                  </div>

                  {/* Yoklama durumu uyarısı */}
                  {noAttendance && (
                    <span className="ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400 shrink-0">
                      Yoklama yok
                    </span>
                  )}
                </li>
              )
            })}
          </ul>

          {/* Mobilde takvim renk açıklaması */}
          <div className="mt-4 pt-3 border-t border-gray-100 dark:border-slate-700 flex sm:hidden flex-wrap gap-x-3 gap-y-1">
            <span className="flex items-center gap-1 text-[10px] text-gray-500 dark:text-slate-400">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              Ödev teslim
            </span>
            <span className="flex items-center gap-1 text-[10px] text-gray-500 dark:text-slate-400">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
              Devamsız
            </span>
            <span className="flex items-center gap-1 text-[10px] text-gray-500 dark:text-slate-400">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              Yoklama yok
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
