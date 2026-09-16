'use client'

import { useRef, useState, useTransition } from 'react'
import { addMentorReport, deleteMentorReport } from '@/app/actions/mentor'
import { format, parseISO, todayLocalISO } from '@/src/shared/date'

type Not = { id: string; content: string; report_date: string }

export default function GorusmeNotlari({
  studentId, classId, notlar,
}: { studentId: string; classId: string; notlar: Not[] }) {
  const [hata, setHata] = useState<string | null>(null)
  const [silOnayId, setSilOnayId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const formRef = useRef<HTMLFormElement>(null)
  const bugun = todayLocalISO()

  function ekle(formData: FormData) {
    setHata(null)
    startTransition(async () => {
      const r = await addMentorReport(studentId, classId, formData)
      if (r.error) setHata(r.error)
      else formRef.current?.reset()
    })
  }

  function sil(id: string) {
    setHata(null)
    startTransition(async () => {
      const r = await deleteMentorReport(id, classId, studentId)
      if (r.error) setHata(r.error)
      setSilOnayId(null)
    })
  }

  return (
    <section className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5">
      <h2 className="font-semibold text-gray-900 dark:text-slate-100 mb-4">Görüşme notları</h2>

      <form ref={formRef} action={ekle} className="space-y-2 mb-5">
        <div>
          <label htmlFor="report_date" className="sr-only">Görüşme tarihi</label>
          <input
            id="report_date"
            type="date"
            name="report_date"
            defaultValue={bugun}
            className="text-sm border border-gray-200 dark:border-slate-700 rounded-xl px-3 min-h-[44px] bg-white dark:bg-slate-900 text-gray-800 dark:text-slate-200"
          />
        </div>
        <div>
          <label htmlFor="content" className="sr-only">Görüşme notu</label>
          <textarea
            id="content"
            name="content"
            rows={3}
            maxLength={2000}
            placeholder="Görüşmede konuşulanlar…"
            className="w-full text-sm border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2 bg-white dark:bg-slate-900 text-gray-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
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
          {notlar.map(n => {
            const tarih = format(parseISO(n.report_date), 'd MMMM yyyy')
            return (
              <li key={n.id} className="border-t border-gray-100 dark:border-slate-700 pt-3">
                {silOnayId === n.id ? (
                  <div>
                    <p className="text-xs text-gray-600 dark:text-slate-300 mb-1">
                      {tarih} tarihli not silinsin mi? Bu işlem geri alınamaz.
                    </p>
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        onClick={() => setSilOnayId(null)}
                        className="inline-flex items-center min-h-[44px] px-2 text-xs text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200"
                      >
                        Vazgeç
                      </button>
                      <button
                        onClick={() => sil(n.id)}
                        disabled={isPending}
                        className="inline-flex items-center min-h-[44px] px-3 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg transition-colors"
                      >
                        {isPending ? 'Siliniyor…' : 'Sil'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-xs font-medium text-gray-500 dark:text-slate-400">{tarih}</p>
                      <button
                        onClick={() => setSilOnayId(n.id)}
                        disabled={isPending}
                        aria-label={`${tarih} tarihli notu sil`}
                        className="inline-flex items-center min-h-[44px] px-2 text-xs text-gray-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 disabled:opacity-50"
                      >
                        Sil
                      </button>
                    </div>
                    <p className="text-sm text-gray-800 dark:text-slate-200 mt-1 whitespace-pre-wrap">{n.content}</p>
                  </>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
