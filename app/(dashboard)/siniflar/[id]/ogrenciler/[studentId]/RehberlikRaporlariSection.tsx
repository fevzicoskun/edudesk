'use client'

import { useRef, useState, useTransition } from 'react'
import { addMentorReport, deleteMentorReport } from '@/app/actions/mentor'
import { format, parseISO } from '@/src/shared/date'

type Report = { id: string; content: string; report_date: string; mentor_id: string; created_at: string }

export default function RehberlikRaporlariSection({
  studentId,
  classId,
  reports,
  canWrite,
}: {
  studentId: string
  classId: string
  reports: Report[]
  canWrite: boolean
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const today = new Date().toISOString().split('T')[0]

  function submit(formData: FormData) {
    setError(null)
    startTransition(async () => {
      const result = await addMentorReport(studentId, classId, formData)
      if (result.error) setError(result.error)
      else formRef.current?.reset()
    })
  }

  function remove(reportId: string) {
    startTransition(async () => {
      await deleteMentorReport(reportId, classId, studentId)
    })
  }

  return (
    <section className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4 mt-4">
      <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3">Rehberlik Görüşmeleri</h2>

      {canWrite && (
        <form ref={formRef} action={submit} className="mb-4 space-y-2">
          <textarea
            name="content"
            required
            minLength={5}
            maxLength={2000}
            placeholder="Görüşme/gözlem notu yaz..."
            className="w-full min-h-24 px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-base bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400 dark:placeholder:text-slate-400"
          />
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="date"
              name="report_date"
              defaultValue={today}
              max={today}
              className="px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-base bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              disabled={isPending}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {isPending ? 'Kaydediliyor…' : 'Rapor Ekle'}
            </button>
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
        </form>
      )}

      {reports.length === 0 ? (
        <p className="text-center text-gray-400 dark:text-slate-500 text-sm py-8">Henüz rehberlik kaydı yok.</p>
      ) : (
        <div className="space-y-2">
          {reports.map((r) => (
            <div key={r.id} className="border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm text-gray-800 dark:text-slate-200 whitespace-pre-wrap flex-1">{r.content}</p>
                {canWrite && (
                  <button
                    type="button"
                    onClick={() => remove(r.id)}
                    disabled={isPending}
                    className="text-xs text-red-400 hover:text-red-600 font-medium transition-colors shrink-0"
                  >
                    Sil
                  </button>
                )}
              </div>
              <p className="text-xs text-gray-400 dark:text-slate-500 mt-2">
                {(() => { try { return format(parseISO(r.report_date), 'd MMM yyyy') } catch { return r.report_date } })()}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
