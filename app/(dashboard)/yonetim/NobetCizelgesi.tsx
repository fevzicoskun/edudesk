import { DutyService } from '@/src/domains/schedule/services/DutyService'
import { todayWeekdayTR } from '@/src/shared/date'

const DAYS: { n: number; label: string }[] = [
  { n: 1, label: 'Pazartesi' },
  { n: 2, label: 'Salı' },
  { n: 3, label: 'Çarşamba' },
  { n: 4, label: 'Perşembe' },
  { n: 5, label: 'Cuma' },
]

// Müdür/MY için okul nöbet çizelgesi — bugün nöbetçileri üstte vurgulu, altta güne göre gruplu ızgara.
// Salt okunur, kendi verisini çeker. RLS (teacher_duties_select) müdür/MY'ye tüm okul nöbetlerini döndürür.
export default async function NobetCizelgesi() {
  const rows = await DutyService.listSchoolDuties()
  const today = todayWeekdayTR() // 1=Pzt … 5=Cum, 6/7=hafta sonu
  const todayLabel = DAYS.find(d => d.n === today)?.label ?? null
  const todayList = rows
    .filter(r => r.day_of_week === today)
    .sort((a, b) => a.teacherName.localeCompare(b.teacherName, 'tr'))

  if (rows.length === 0) {
    return (
      <section className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-slate-100 mb-1">Okul Nöbet Çizelgesi</h2>
        <p className="text-sm text-gray-500 dark:text-slate-400">
          Henüz nöbet bilgisi giren öğretmen yok. Öğretmenler Ders Programım sayfasından kendi nöbetlerini ekler.
        </p>
      </section>
    )
  }

  const byDay = new Map<number, typeof rows>()
  for (const r of rows) {
    const list = byDay.get(r.day_of_week) ?? []
    list.push(r)
    byDay.set(r.day_of_week, list)
  }

  return (
    <section className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
      <h2 className="text-sm font-semibold text-gray-900 dark:text-slate-100 mb-3">Okul Nöbet Çizelgesi</h2>

      {/* Bugün nöbetçiler — MY'nin her gün ilk merak ettiği bilgi, en üstte vurgulu */}
      <div className="mb-4 rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/30 p-3">
        <h3 className="text-xs font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wide mb-2">
          {todayLabel ? `Bugün Nöbetçiler · ${todayLabel}` : 'Bugün Nöbetçiler'}
        </h3>
        {todayLabel === null ? (
          <p className="text-sm text-gray-500 dark:text-slate-400">Bugün hafta sonu, okul nöbeti yok.</p>
        ) : todayList.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-slate-400">Bugün için nöbet bilgisi giren öğretmen yok.</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {todayList.map((r, i) => (
              <li key={`${r.teacher_id}-${i}`} className="rounded-lg bg-white dark:bg-slate-800 border border-blue-100 dark:border-blue-900/50 px-2.5 py-1.5">
                <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">{r.teacherName}</p>
                <p className="text-xs text-gray-500 dark:text-slate-400">{r.time_range} · {r.location}</p>
                {r.notes && <p className="text-[11px] text-gray-500 dark:text-slate-400 truncate">{r.notes}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {DAYS.map(d => {
          const list = (byDay.get(d.n) ?? []).sort((a, b) => a.teacherName.localeCompare(b.teacherName, 'tr'))
          return (
            <div key={d.n}>
              <h3 className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-2">{d.label}</h3>
              {list.length === 0 ? (
                <p className="text-xs text-gray-300 dark:text-slate-600">—</p>
              ) : (
                <ul className="space-y-2">
                  {list.map((r, i) => (
                    // Bir öğretmenin aynı günde >1 nöbeti olabilir → key'e index ekle (çakışma önlenir).
                    <li key={`${r.teacher_id}-${i}`} className="rounded-lg border border-gray-100 dark:border-slate-800 px-2 py-1.5">
                      <p className="text-sm font-medium text-gray-800 dark:text-slate-200 truncate">{r.teacherName}</p>
                      <p className="text-xs text-gray-500 dark:text-slate-400">{r.time_range} · {r.location}</p>
                      {r.notes && <p className="text-[11px] text-gray-500 dark:text-slate-400 truncate">{r.notes}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
