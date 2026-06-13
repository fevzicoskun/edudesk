import Link from 'next/link'
import { format, parseISO } from '@/src/shared/date'
import type { SubmissionStatus } from '@/src/shared/types'

type HomeworkRel = { id: string; title: string; subject: string; due_date: string } | null
type SubmissionRow = { id: string; status: SubmissionStatus; updated_at: string; homeworks: HomeworkRel }

const LABELS: Record<SubmissionStatus, string> = {
  yapildi: 'Yapıldı', eksik: 'Eksik', yapilmadi: 'Yapılmadı', gec: 'Geç', mazeretli: 'Mazeretli',
}

const BADGE: Record<SubmissionStatus, string> = {
  yapildi:   'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800',
  eksik:     'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800',
  yapilmadi: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800',
  gec:       'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800',
  mazeretli: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600',
}

export default function OdevGecmisiSection({ submissions }: { submissions: SubmissionRow[] }) {
  return (
    <section className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4">
      <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3">Ödev Geçmişi</h2>
      {submissions.length === 0 ? (
        <p className="text-center text-gray-400 dark:text-slate-500 text-sm py-10">Henüz ödev kaydı yok.</p>
      ) : (
        <div className="space-y-2">
          {submissions.map((s) => (
            <Link
              key={s.id}
              href={s.homeworks?.id ? `/odevler/${s.homeworks.id}` : '#'}
              className="border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 flex items-center justify-between gap-3 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors block"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">{s.homeworks?.title ?? 'Ödev'}</p>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                  {s.homeworks?.subject ?? '—'} ·{' '}
                  {s.homeworks?.due_date ? format(parseISO(s.homeworks.due_date), 'd MMM yyyy') : 'Tarih yok'}
                </p>
              </div>
              <span className={`border rounded-full px-2.5 py-1 text-xs font-semibold shrink-0 ${BADGE[s.status]}`}>
                {LABELS[s.status]}
              </span>
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}
