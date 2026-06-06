import type { ClassWeekLoad, WeekLoadItem } from '@/src/domains/homework/lib/week-load'

const DAYS   = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt']
const MONTHS = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara']

function dayLabel(dateStr: string): string {
  try {
    const [y, m, d] = dateStr.split('-').map(Number)
    const dt = new Date(y, m - 1, d)
    return `${DAYS[dt.getDay()]} ${d} ${MONTHS[m - 1]}`
  } catch { return dateStr }
}

export default function WeekLoadBanner({
  loads,
  loading,
  dueDate = '',
  isCreating = false,
}: {
  loads: ClassWeekLoad[]
  loading: boolean
  dueDate?: string
  isCreating?: boolean
}) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-400">
        <svg className="w-3.5 h-3.5 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        Haftalık yük hesaplanıyor…
      </div>
    )
  }

  const hasAnyLoad = loads.some(l => l.count > 0)

  if (!dueDate && !hasAnyLoad) return null
  // Veri henüz gelmedi ya da hata oldu — hiçbir şey gösterme
  if (!loading && loads.length === 0) return null

  // Seçili tarih var ama bu hafta başka hiç ödev yok
  if (isCreating && dueDate && !hasAnyLoad) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-xl text-xs text-green-700">
        <svg className="w-3.5 h-3.5 text-green-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        Bu hafta başka ödev yok — uygun
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {loads.map(load => (
        <ClassSection
          key={load.classId}
          load={load}
          dueDate={dueDate}
          isCreating={isCreating}
          showClassName={loads.length > 1}
        />
      ))}
    </div>
  )
}

function ClassSection({
  load,
  dueDate,
  isCreating,
  showClassName,
}: {
  load: ClassWeekLoad
  dueDate: string
  isCreating: boolean
  showClassName: boolean
}) {
  // Ödevleri güne göre grupla
  const byDay = new Map<string, WeekLoadItem[]>()
  for (const item of load.items) {
    const cur = byDay.get(item.dueDate) ?? []
    byDay.set(item.dueDate, [...cur, item])
  }

  // Gösterilecek tüm günler (mevcut + seçili gün)
  const allDays = new Set(byDay.keys())
  if (isCreating && dueDate) allDays.add(dueDate)
  const sortedDays = [...allDays].sort()

  if (sortedDays.length === 0) return null

  // Bu ödev dahil efektif yük
  const effectiveCount = load.count + (isCreating ? 1 : 0)
  const effectiveLevel: 'ok' | 'warn' | 'danger' =
    effectiveCount >= 5 ? 'danger' : effectiveCount >= 3 ? 'warn' : 'ok'

  // Seçili günde zaten başka ödev var mı?
  const itemsOnSelected = dueDate ? (byDay.get(dueDate) ?? []) : []
  const hasConflict     = isCreating && itemsOnSelected.length > 0

  const borderCls =
    effectiveLevel === 'danger' ? 'border-red-200' :
    effectiveLevel === 'warn'   ? 'border-amber-200' :
                                  'border-gray-200'

  const headerBg =
    effectiveLevel === 'danger' ? 'bg-red-50' :
    effectiveLevel === 'warn'   ? 'bg-amber-50' :
                                  'bg-gray-50'

  const headerText =
    effectiveLevel === 'danger' ? 'text-red-700' :
    effectiveLevel === 'warn'   ? 'text-amber-700' :
                                  'text-gray-600'

  return (
    <div className={`border ${borderCls} rounded-xl overflow-hidden`}>
      {/* Başlık */}
      <div className={`flex items-center gap-1.5 px-3 py-2 ${headerBg}`}>
        {effectiveLevel !== 'ok' ? (
          <svg
            className={`w-3.5 h-3.5 shrink-0 ${effectiveLevel === 'danger' ? 'text-red-500' : 'text-amber-500'}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
          </svg>
        ) : (
          <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        )}
        <span className={`text-xs font-semibold ${headerText}`}>
          {showClassName && `${load.className} · `}
          Bu hafta {effectiveCount} ödev
          {hasConflict              && ' — seçili gün kalabalık'}
          {!hasConflict && effectiveLevel === 'danger' && ' — fazla yük!'}
          {!hasConflict && effectiveLevel === 'warn'   && ' — dikkat'}
        </span>
      </div>

      {/* Gün bazlı satırlar */}
      <div className="divide-y divide-gray-100 bg-white">
        {sortedDays.map(day => {
          const items         = byDay.get(day) ?? []
          const isSelected    = day === dueDate
          const isConflictDay = isCreating && isSelected && items.length > 0

          return (
            <div
              key={day}
              className={`flex gap-3 px-3 py-2 ${
                isConflictDay               ? 'bg-amber-50' :
                isSelected && isCreating    ? 'bg-blue-50/40' :
                                              ''
              }`}
            >
              {/* Gün etiketi */}
              <span className={`text-[11px] font-medium shrink-0 w-16 pt-0.5 ${
                isSelected ? 'text-blue-600' : 'text-gray-400'
              }`}>
                {dayLabel(day)}
              </span>

              {/* Ödevler */}
              <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                {items.map((item, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-xs min-w-0">
                    <span className={`shrink-0 ${item.isOwn ? 'text-blue-400' : 'text-gray-300'}`}>
                      {item.isOwn ? '★' : '·'}
                    </span>
                    <span className={`truncate ${item.isOwn ? 'text-gray-700 font-medium' : 'text-gray-500'}`}>
                      {item.subject}
                      {!item.isOwn && (
                        <span className="text-gray-400 font-normal"> · {item.teacherName}</span>
                      )}
                    </span>
                  </div>
                ))}

                {/* Yeni oluşturulan ödev göstergesi */}
                {isCreating && isSelected && (
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="text-blue-500 shrink-0">★</span>
                    <span className="text-blue-600 font-semibold">Bu ödev</span>
                    {isConflictDay && (
                      <span className="ml-1 text-[11px] font-bold text-amber-600">çakışma!</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
