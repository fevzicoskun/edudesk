'use client'

import { useState, useTransition } from 'react'
import { updateExamGrades } from '@/app/actions/zumre'
import { format, parseISO } from 'date-fns'
import { tr } from 'date-fns/locale'

interface Exam {
  id: string
  title: string
  subject: string
  exam_date: string
  grades: number[] | null
}

function stats(grades: number[]) {
  if (!grades.length) return null
  const avg = Math.round(grades.reduce((s, n) => s + n, 0) / grades.length)
  const min = Math.min(...grades)
  const max = Math.max(...grades)
  const gecen = grades.filter(g => g >= 50).length
  return { avg, min, max, gecen, total: grades.length }
}

export default function SinavCard({
  exam,
  onDelete,
}: {
  exam: Exam
  onDelete: () => void
}) {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState((exam.grades ?? []).join(', '))
  const [saved, setSaved] = useState(exam.grades ?? [])
  const [, startTransition] = useTransition()

  const save = () => {
    const parsed = input
      .split(/[,\s]+/)
      .map(s => parseInt(s.trim(), 10))
      .filter(n => !isNaN(n) && n >= 0 && n <= 100)
    setSaved(parsed)
    startTransition(() => { updateExamGrades(exam.id, input) })
  }

  const s = stats(saved)

  let dateStr = ''
  try { dateStr = format(parseISO(exam.exam_date), 'd MMMM yyyy', { locale: tr }) } catch {}

  return (
    <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
      <div className="px-4 py-3 flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-gray-900 dark:text-slate-100">{exam.title}</p>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
            {exam.subject} · {dateStr}
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {s && (
            <div className="hidden sm:flex items-center gap-3 text-xs text-gray-500 dark:text-slate-400">
              <span className="font-semibold text-blue-600 dark:text-blue-400">Ort: {s.avg}</span>
              <span>{s.gecen}/{s.total} geçti</span>
            </div>
          )}
          <button
            onClick={() => setOpen(o => !o)}
            className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 transition-colors"
          >
            {open ? 'Kapat' : (saved.length ? 'Notlar' : '+ Not gir')}
          </button>
          <button onClick={onDelete} className="text-xs text-red-400 hover:text-red-600 font-medium transition-colors">
            Sil
          </button>
        </div>
      </div>

      {open && (
        <div className="px-4 pb-4 border-t border-gray-100 dark:border-slate-700 pt-3 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">
              Notları girin (virgülle ya da boşlukla ayrılmış, 0–100)
            </label>
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              rows={2}
              placeholder="45, 67, 89, 92, 55, 78..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
          <button
            onClick={save}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            Kaydet
          </button>
          {s && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              {[
                { label: 'Ortalama', value: s.avg },
                { label: 'En yüksek', value: s.max },
                { label: 'En düşük', value: s.min },
                { label: `Geçen (≥50)`, value: `${s.gecen}/${s.total}` },
              ].map(({ label, value }) => (
                <div key={label} className="bg-gray-50 dark:bg-slate-700 rounded-lg px-3 py-2 text-center">
                  <p className="text-base font-bold text-gray-900 dark:text-slate-100">{value}</p>
                  <p className="text-[11px] text-gray-500 dark:text-slate-400">{label}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
