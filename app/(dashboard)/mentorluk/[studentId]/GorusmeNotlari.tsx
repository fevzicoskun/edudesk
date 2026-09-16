'use client'

import { useRef, useState, useTransition } from 'react'
import { addMentorReport, deleteMentorReport } from '@/app/actions/mentor'
import { format, parseISO } from '@/src/shared/date'

type Not = { id: string; content: string; report_date: string }

export default function GorusmeNotlari({
  studentId, classId, notlar,
}: { studentId: string; classId: string; notlar: Not[] }) {
  const [hata, setHata] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const formRef = useRef<HTMLFormElement>(null)
  const bugun = new Date().toISOString().split('T')[0]

  function ekle(formData: FormData) {
    setHata(null)
    startTransition(async () => {
      const r = await addMentorReport(studentId, classId, formData)
      if (r.error) setHata(r.error)
      else formRef.current?.reset()
    })
  }

  function sil(id: string) {
    startTransition(async () => {
      const r = await deleteMentorReport(id, classId, studentId)
      if (r.error) setHata(r.error)
    })
  }

  return (
    <section className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5">
      <h2 className="font-semibold text-gray-900 dark:text-slate-100 mb-4">Görüşme notları</h2>

      <form ref={formRef} action={ekle} className="space-y-2 mb-5">
        <input
          type="date"
          name="report_date"
          defaultValue={bugun}
          aria-label="Görüşme tarihi"
          className="text-sm border border-gray-200 dark:border-slate-700 rounded-xl px-3 min-h-[44px] bg-white dark:bg-slate-900 text-gray-800 dark:text-slate-200"
        />
        <textarea
          name="content"
          rows={3}
          maxLength={2000}
          placeholder="Görüşmede konuşulanlar…"
          aria-label="Görüşme notu"
          className="w-full text-sm border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2 bg-white dark:bg-slate-900 text-gray-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {hata && <p role="alert" className="text-xs text-red-600 dark:text-red-400">{hata}</p>}
        <button
          type="submit"
          disabled={isPending}
          className="min-h-[44px] px-4 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
        >
          {isPending ? 'Kaydediliyor…' : 'Not ekle'}
        </button>
      </form>

      {notlar.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-slate-400">Henüz görüşme notu yok.</p>
      ) : (
        <ul className="space-y-3">
          {notlar.map(n => (
            <li key={n.id} className="border-t border-gray-100 dark:border-slate-700 pt-3">
              <div className="flex items-start justify-between gap-3">
                <p className="text-xs font-medium text-gray-500 dark:text-slate-400">
                  {format(parseISO(n.report_date), 'd MMMM yyyy')}
                </p>
                <button
                  onClick={() => sil(n.id)}
                  disabled={isPending}
                  aria-label="Notu sil"
                  className="text-xs text-gray-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 disabled:opacity-50"
                >
                  Sil
                </button>
              </div>
              <p className="text-sm text-gray-800 dark:text-slate-200 mt-1 whitespace-pre-wrap">{n.content}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
