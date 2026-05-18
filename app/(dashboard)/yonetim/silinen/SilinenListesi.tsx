'use client'

import { useTransition } from 'react'
import { restoreClass, restoreStudent } from '@/app/actions/classes'
import { restoreHomework } from '@/app/actions/homework'
import { restoreMeeting, restoreExam } from '@/app/actions/zumre'
import { format, parseISO } from '@/src/shared/date'

interface DeletedItem { id: string; deleted_at: string }
interface DeletedClass extends DeletedItem { name: string; grade: number }
interface DeletedStudent extends DeletedItem { full_name: string; class_id: string }
interface DeletedHomework extends DeletedItem { title: string; subject: string }
interface DeletedMeeting extends DeletedItem { title: string; meeting_date: string }
interface DeletedExam extends DeletedItem { title: string; exam_date: string }

function RestoreBtn({ label, onRestore }: { label: string; onRestore: () => Promise<void> }) {
  const [pending, startTransition] = useTransition()
  return (
    <button
      disabled={pending}
      onClick={() => startTransition(onRestore)}
      className="text-xs font-medium text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300 disabled:opacity-50 transition-colors"
    >
      {pending ? 'Geri alınıyor…' : 'Geri al'}
    </button>
  )
}

function Section<T extends DeletedItem>({
  title,
  items,
  renderRow,
}: {
  title: string
  items: T[]
  renderRow: (item: T) => React.ReactNode
}) {
  if (items.length === 0) return null
  return (
    <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-700">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300">{title}</h2>
      </div>
      <div className="divide-y divide-gray-50 dark:divide-slate-700">
        {items.map(item => (
          <div key={item.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
            <div className="min-w-0 flex-1">{renderRow(item)}</div>
            <span className="text-xs text-gray-400 dark:text-slate-500 shrink-0">
              {format(parseISO(item.deleted_at), 'd MMM')}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function SilinenListesi({
  classes, students, homeworks, meetings, exams,
}: {
  classes: DeletedClass[]
  students: DeletedStudent[]
  homeworks: DeletedHomework[]
  meetings: DeletedMeeting[]
  exams: DeletedExam[]
}) {
  const total = classes.length + students.length + homeworks.length + meetings.length + exams.length

  if (total === 0) {
    return (
      <p className="text-center py-12 text-gray-400 dark:text-slate-500 text-sm">
        Son 30 günde silinen kayıt bulunamadı.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <Section
        title="Sınıflar"
        items={classes}
        renderRow={c => (
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-gray-800 dark:text-slate-200">{c.name}</p>
              <p className="text-xs text-gray-400">{c.grade}. Sınıf</p>
            </div>
            <RestoreBtn label="Geri al" onRestore={() => restoreClass(c.id)} />
          </div>
        )}
      />

      <Section
        title="Öğrenciler"
        items={students}
        renderRow={s => (
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-gray-800 dark:text-slate-200">{s.full_name}</p>
            <RestoreBtn label="Geri al" onRestore={() => restoreStudent(s.id, s.class_id)} />
          </div>
        )}
      />

      <Section
        title="Ödevler"
        items={homeworks}
        renderRow={h => (
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-gray-800 dark:text-slate-200">{h.title}</p>
              <p className="text-xs text-gray-400">{h.subject}</p>
            </div>
            <RestoreBtn label="Geri al" onRestore={() => restoreHomework(h.id)} />
          </div>
        )}
      />

      <Section
        title="Zümre Toplantıları"
        items={meetings}
        renderRow={m => (
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-gray-800 dark:text-slate-200">{m.title}</p>
              <p className="text-xs text-gray-400">{format(parseISO(m.meeting_date), 'd MMMM yyyy')}</p>
            </div>
            <RestoreBtn label="Geri al" onRestore={() => restoreMeeting(m.id)} />
          </div>
        )}
      />

      <Section
        title="Ortak Sınavlar"
        items={exams}
        renderRow={e => (
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-gray-800 dark:text-slate-200">{e.title}</p>
              <p className="text-xs text-gray-400">{format(parseISO(e.exam_date), 'd MMMM yyyy')}</p>
            </div>
            <RestoreBtn label="Geri al" onRestore={() => restoreExam(e.id)} />
          </div>
        )}
      />
    </div>
  )
}
