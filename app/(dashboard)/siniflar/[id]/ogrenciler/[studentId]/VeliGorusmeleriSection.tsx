import { format, parseISO } from '@/src/shared/date'

export interface MeetingRow {
  id: string
  meet_date: string
  period: number
  status: string
  note: string | null
  teacher_id: string
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  planlandi: { label: 'Planlandı', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  yapildi:   { label: 'Yapıldı',   cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
  iptal:     { label: 'İptal',     cls: 'bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-slate-400' },
}

// Öğrenci 360: öğrencinin veli görüşmeleri (RLS: öğretmen kendi, müdür/MY okul geneli).
export default function VeliGorusmeleriSection({
  meetings, teacherNames, hasError,
}: { meetings: MeetingRow[]; teacherNames: Record<string, string>; hasError: boolean }) {
  return (
    <section className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4 mt-4">
      <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3">Veli Görüşmeleri</h2>
      {hasError ? (
        <p className="text-sm text-gray-500 dark:text-slate-400">Görüşmeler yüklenemedi.</p>
      ) : meetings.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-slate-400">Bu öğrenciyle kayıtlı veli görüşmesi yok.</p>
      ) : (
        <div className="space-y-2">
          {meetings.map(m => {
            const badge = STATUS_BADGE[m.status] ?? STATUS_BADGE.planlandi
            return (
              <div key={m.id} className="border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-gray-800 dark:text-slate-200">
                    {format(parseISO(m.meet_date), 'd MMM yyyy')} · {m.period}. ders
                  </span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badge.cls}`}>{badge.label}</span>
                  <span className="text-xs text-gray-500 dark:text-slate-400 ml-auto">
                    {teacherNames[m.teacher_id] ?? 'Öğretmen'}
                  </span>
                </div>
                {m.note && <p className="text-sm text-gray-600 dark:text-slate-300 mt-1 whitespace-pre-wrap">{m.note}</p>}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
