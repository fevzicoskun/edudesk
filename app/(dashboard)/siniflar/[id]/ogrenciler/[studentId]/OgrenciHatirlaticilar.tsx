'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { Task } from '@/src/domains/tasks/services/TaskService'
import { createTask, completeTask, deleteTask } from '@/app/actions/tasks'
import { format, parseISO } from '@/src/shared/date'

export default function OgrenciHatirlaticilar({
  initial, studentId, classId,
}: { initial: Task[]; studentId: string; classId: string }) {
  const [tasks, setTasks] = useState<Task[]>(initial)
  const [title, setTitle] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  function add() {
    const t = title.trim()
    if (!t) return
    setErr(null)
    startTransition(async () => {
      const res = await createTask({ title: t, studentId, classId })
      if (res.error) { setErr(res.error); return }
      if (res.task) setTasks(prev => [res.task!, ...prev])
      setTitle('')
      router.refresh()
    })
  }

  function complete(id: string) {
    const idx = tasks.findIndex(t => t.id === id)
    if (idx === -1) return
    const removed = tasks[idx]
    setErr(null)
    setTasks(prev => prev.filter(t => t.id !== id))
    startTransition(async () => {
      const res = await completeTask(id)
      if (res.error) {
        setErr(res.error)
        setTasks(prev => { const next = [...prev]; next.splice(idx, 0, removed); return next })
        return
      }
      router.refresh()
    })
  }

  function remove(id: string) {
    const idx = tasks.findIndex(t => t.id === id)
    if (idx === -1) return
    const removed = tasks[idx]
    setErr(null)
    setTasks(prev => prev.filter(t => t.id !== id))
    startTransition(async () => {
      const res = await deleteTask(id)
      if (res.error) {
        setErr(res.error)
        setTasks(prev => { const next = [...prev]; next.splice(idx, 0, removed); return next })
        return
      }
      router.refresh()
    })
  }

  return (
    <section className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4 mt-4">
      <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3">Hatırlatıcılar</h2>
      <div className="flex gap-2 mb-3">
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') add() }}
          maxLength={200}
          placeholder="Bu öğrenciyle ilgili hatırlatıcı… (örn. veliyle görüş)"
          className="flex-1 px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-base bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-500 dark:placeholder:text-slate-400"
        />
        <button
          type="button"
          onClick={add}
          disabled={pending || !title.trim()}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          Ekle
        </button>
      </div>
      {err && <p className="text-xs text-red-500 dark:text-red-400 mb-2">{err}</p>}
      {tasks.length === 0 ? (
        <p className="text-center text-gray-500 dark:text-slate-400 text-sm py-4">Bu öğrenci için hatırlatıcı yok.</p>
      ) : (
        <ul className="space-y-2">
          {tasks.map(t => (
            <li key={t.id} className="flex items-center gap-2 border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2">
              <button
                type="button"
                onClick={() => complete(t.id)}
                aria-label="Tamamla"
                className="w-4 h-4 shrink-0 rounded-full border-2 border-gray-300 dark:border-slate-500 hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors"
              />
              <span className="text-sm text-gray-800 dark:text-slate-200 flex-1 min-w-0 truncate">{t.title}</span>
              {t.due_date && (
                <span className={`text-[11px] shrink-0 ${t.overdue ? 'text-red-500 dark:text-red-400 font-semibold' : 'text-gray-500 dark:text-slate-400'}`}>
                  {t.overdue ? 'Gecikti · ' : ''}{format(parseISO(t.due_date), 'd MMM')}
                </span>
              )}
              <button
                type="button"
                onClick={() => remove(t.id)}
                aria-label="Sil"
                className="text-[11px] text-gray-400 hover:text-red-500 transition-colors shrink-0"
              >
                Sil
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
