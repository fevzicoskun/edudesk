'use client'

import { useState, useTransition } from 'react'
import type { Task } from '@/src/domains/tasks/services/TaskService'
import { createTask, completeTask, snoozeTask, deleteTask } from '@/app/actions/tasks'
import { format, parseISO } from '@/src/shared/date'

export default function Yapilacaklarim({ initial }: { initial: Task[] }) {
  const [tasks, setTasks] = useState<Task[]>(initial)
  const [title, setTitle] = useState('')
  const [pending, startTransition] = useTransition()
  const [err, setErr] = useState<string | null>(null)

  function add() {
    const t = title.trim()
    if (!t) return
    setErr(null)
    startTransition(async () => {
      const res = await createTask({ title: t })
      if (res.error) { setErr(res.error); return }
      if (res.task) setTasks(prev => [res.task!, ...prev])
      setTitle('')
    })
  }

  function complete(id: string) {
    const idx = tasks.findIndex(t => t.id === id)
    if (idx === -1) return
    const removed = tasks[idx]
    setTasks(prev => prev.filter(t => t.id !== id)) // optimistik
    startTransition(async () => {
      const res = await completeTask(id)
      if (res.error) {
        setErr(res.error)
        setTasks(prev => { const next = [...prev]; next.splice(idx, 0, removed); return next })
      }
    })
  }

  function snooze(id: string, option: 'tomorrow' | 'nextWeek') {
    const idx = tasks.findIndex(t => t.id === id)
    if (idx === -1) return
    const removed = tasks[idx]
    setTasks(prev => prev.filter(t => t.id !== id)) // ertelenince bugünden düşer
    startTransition(async () => {
      const res = await snoozeTask({ id, option })
      if (res.error) {
        setErr(res.error)
        setTasks(prev => { const next = [...prev]; next.splice(idx, 0, removed); return next })
      }
    })
  }

  function remove(id: string) {
    const idx = tasks.findIndex(t => t.id === id)
    if (idx === -1) return
    const removed = tasks[idx]
    setTasks(prev => prev.filter(t => t.id !== id))
    startTransition(async () => {
      const res = await deleteTask(id)
      if (res.error) {
        setErr(res.error)
        setTasks(prev => { const next = [...prev]; next.splice(idx, 0, removed); return next })
      }
    })
  }

  return (
    <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden mb-4">
      <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-700">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300">Yapılacaklarım</h2>
      </div>

      {/* Capture kutusu */}
      <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-700/60">
        <div className="flex gap-2">
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') add() }}
            maxLength={200}
            placeholder="Bir iş ekle… (örn. 9-B velilerini ara)"
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
        {err && <p className="text-xs text-red-500 mt-1.5">{err}</p>}
      </div>

      {/* Liste */}
      {tasks.length === 0 ? (
        <p className="px-4 py-4 text-center text-sm text-gray-500 dark:text-slate-400">Bekleyen işin yok.</p>
      ) : (
        <ul className="divide-y divide-gray-100 dark:divide-slate-700/60">
          {tasks.map(t => (
            <li key={t.id} className="px-4 py-2.5 flex items-center gap-2">
              <button
                type="button"
                onClick={() => complete(t.id)}
                aria-label="Tamamla"
                className="w-4 h-4 shrink-0 rounded-full border-2 border-gray-300 dark:border-slate-500 hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-gray-800 dark:text-slate-200 truncate">{t.title}</p>
                {t.due_date && (
                  <p className={`text-[11px] ${t.overdue ? 'text-red-500 dark:text-red-400 font-semibold' : 'text-gray-500 dark:text-slate-400'}`}>
                    {t.overdue ? 'Gecikti · ' : ''}{format(parseISO(t.due_date), 'd MMM')}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button type="button" onClick={() => snooze(t.id, 'tomorrow')} aria-label="Yarına ertele" className="text-[11px] text-gray-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 px-1.5 py-0.5 rounded transition-colors">Yarın</button>
                <button type="button" onClick={() => snooze(t.id, 'nextWeek')} aria-label="Gelecek haftaya ertele" className="text-[11px] text-gray-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 px-1.5 py-0.5 rounded transition-colors">+7g</button>
                <button type="button" onClick={() => remove(t.id)} aria-label="Sil" className="text-[11px] text-gray-400 hover:text-red-500 px-1.5 py-0.5 rounded transition-colors">Sil</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
