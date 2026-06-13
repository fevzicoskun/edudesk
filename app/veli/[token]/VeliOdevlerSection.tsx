import { format, parseISO } from '@/src/shared/date'

type SubmissionStatus = 'yapildi' | 'eksik' | 'yapilmadi' | 'gec' | 'mazeretli'
type HomeworkRel = { title: string; subject: string; due_date: string; description: string | null } | null
export type SubmissionRow = { id: string; status: SubmissionStatus; updated_at: string; homeworks: HomeworkRel }

const LABELS: Record<SubmissionStatus, string> = {
  yapildi: 'Yapıldı', eksik: 'Eksik', yapilmadi: 'Yapılmadı', gec: 'Geç Teslim', mazeretli: 'Mazeretli',
}

const BADGE_COLOR: Record<SubmissionStatus, string> = {
  yapildi:   'bg-green-100 text-green-700 border-green-200',
  eksik:     'bg-yellow-100 text-yellow-700 border-yellow-200',
  yapilmadi: 'bg-red-100 text-red-700 border-red-200',
  gec:       'bg-orange-100 text-orange-700 border-orange-200',
  mazeretli: 'bg-slate-100 text-slate-600 border-slate-200',
}

const DOT_COLOR: Record<SubmissionStatus, string> = {
  yapildi: 'bg-green-500', eksik: 'bg-yellow-400', yapilmadi: 'bg-red-500',
  gec: 'bg-orange-400', mazeretli: 'bg-slate-400',
}

export default function VeliOdevlerSection({
  upcoming,
  past,
  today,
}: {
  upcoming: SubmissionRow[]
  past: SubmissionRow[]
  today: string
}) {
  return (
    <>
      {upcoming.length > 0 && (
        <section data-veli-section="odevler" className="bg-white border border-gray-200 rounded-2xl p-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Güncel ve Yaklaşan Ödevler</h2>
          <div className="space-y-2.5">
            {upcoming.map(s => {
              const hw = s.homeworks
              const isOverdue = (hw?.due_date ?? '') < today
              return (
                <div key={s.id} className="flex items-start gap-3">
                  <div className={`mt-1.5 w-2.5 h-2.5 rounded-full shrink-0 ${DOT_COLOR[s.status]}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{hw?.title ?? 'Ödev'}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {hw?.subject ?? '—'} ·{' '}
                      <span className={isOverdue ? 'text-red-500 font-medium' : ''}>
                        {hw?.due_date ? format(parseISO(hw.due_date), 'd MMMM yyyy') : '—'}
                        {isOverdue ? ' (Geçti)' : ''}
                      </span>
                    </p>
                  </div>
                  <span className={`border rounded-full px-2 py-0.5 text-xs font-semibold shrink-0 ${BADGE_COLOR[s.status]}`}>
                    {LABELS[s.status]}
                  </span>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {past.length > 0 && (
        <section data-veli-section="odevler" className="bg-white border border-gray-200 rounded-2xl p-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Geçmiş Ödevler</h2>
          <div className="space-y-2">
            {past.map(s => {
              const hw = s.homeworks
              return (
                <div key={s.id} className="flex items-center justify-between gap-3 py-1.5 border-b border-gray-50 last:border-0">
                  <div className="min-w-0">
                    <p className="text-sm text-gray-800 truncate">{hw?.title ?? 'Ödev'}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {hw?.subject ?? '—'} · {hw?.due_date ? format(parseISO(hw.due_date), 'd MMM yyyy') : '—'}
                    </p>
                  </div>
                  <span className={`border rounded-full px-2 py-0.5 text-xs font-semibold shrink-0 ${BADGE_COLOR[s.status]}`}>
                    {LABELS[s.status]}
                  </span>
                </div>
              )
            })}
          </div>
        </section>
      )}
    </>
  )
}
