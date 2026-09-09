'use client'

import { useState, useTransition } from 'react'
import { addPlanItem, updatePlanItem, deletePlanItem, copyPreviousWeekPlan, addStudentSource, removeStudentSource } from '@/app/actions/study-plan'
import { PLAN_STATUS_LABELS, weekDays, dayLabel, groupBySubject, type PlanStatus } from '@/src/domains/studyPlan/planMath'
import type { PlanItemWithTeacher, StudentSource } from '@/src/domains/studyPlan/services/StudyPlanService'

const STATUS_CLS: Record<PlanStatus, string> = {
  planlandi: 'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-300',
  yapildi:   'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  eksik:     'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
  yapilmadi: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
}
const CYCLE: PlanStatus[] = ['yapildi', 'eksik', 'yapilmadi']
const input = 'px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500'

export default function HaftaEditoru({
  studentId, weekStart, items, sources, currentUserId, canWrite, showTeacher = false,
}: {
  studentId: string; weekStart: string; items: PlanItemWithTeacher[]; sources: StudentSource[]
  currentUserId: string; canWrite: boolean; showTeacher?: boolean
}) {
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [desc, setDesc] = useState('')
  const [source, setSource] = useState('')
  const [day, setDay] = useState('')
  const [newSource, setNewSource] = useState('')

  const days = weekDays(weekStart)
  const listId = `kaynaklar-${studentId}`
  const mine = items.filter(i => i.teacher_id === currentUserId)

  function run(fn: () => Promise<{ error?: string }>, after?: () => void) {
    setError(null)
    start(async () => {
      const r = await fn()
      if (r.error) setError(r.error); else after?.()
    })
  }

  const groups = showTeacher ? groupBySubject(items) : [{ subject: '', items }]

  return (
    <div className="space-y-3" data-hafta-editoru>
      {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {items.length === 0 && (
        <p className="text-sm text-gray-500 dark:text-slate-400">Bu hafta için plan yok.</p>
      )}

      {groups.map(g => (
        <div key={g.subject}>
          {g.subject && <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 mb-1">{g.subject}</p>}
          <ul className="space-y-1.5">
            {g.items.map(it => {
              const own = it.teacher_id === currentUserId
              return (
                <li key={it.id} className="flex flex-wrap items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                  <span className="text-xs w-10 shrink-0 text-gray-500 dark:text-slate-400">{dayLabel(it.plan_date)}</span>
                  <span className="flex-1 min-w-0 text-sm text-gray-900 dark:text-slate-100">
                    {it.source && <span className="font-medium">{it.source} · </span>}{it.description}
                    {showTeacher && !own && <span className="text-xs text-gray-500 dark:text-slate-400"> — {it.teacher_name}</span>}
                    {!own && it.note && <span className="block text-xs text-gray-500 dark:text-slate-400">Not: {it.note}</span>}
                  </span>
                  {own && canWrite && (
                    <input
                      aria-label="Not"
                      maxLength={300}
                      placeholder="Not"
                      defaultValue={it.note ?? ''}
                      disabled={pending}
                      className={`${input} w-40 text-xs`}
                      onBlur={e => {
                        const v = e.target.value.trim()
                        if (v !== (it.note ?? '')) run(() => updatePlanItem({ id: it.id, note: v || null }))
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() }
                      }}
                    />
                  )}
                  {own && canWrite ? (
                    <span className="flex items-center gap-1">
                      {CYCLE.map(s => (
                        <button key={s} type="button" disabled={pending}
                          aria-pressed={it.status === s}
                          onClick={() => run(() => updatePlanItem({ id: it.id, status: it.status === s ? 'planlandi' : s }))}
                          className={`text-xs px-2 py-1 rounded-full ${it.status === s ? STATUS_CLS[s] + ' ring-2 ring-offset-1 ring-current' : 'bg-gray-50 text-gray-500 dark:bg-slate-700 dark:text-slate-400'}`}>
                          {PLAN_STATUS_LABELS[s]}
                        </button>
                      ))}
                      <button type="button" disabled={pending} aria-label="Maddeyi sil"
                        onClick={() => run(() => deletePlanItem(it.id))}
                        className="text-xs text-gray-500 dark:text-slate-400 hover:text-red-600 px-1">✕</button>
                    </span>
                  ) : (
                    <span className={`text-xs px-2 py-1 rounded-full ${STATUS_CLS[it.status]}`}>{PLAN_STATUS_LABELS[it.status]}</span>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      ))}

      {canWrite && (
        <form
          className="flex flex-wrap gap-2 items-end"
          onSubmit={e => {
            e.preventDefault()
            run(() => addPlanItem({ studentId, weekStart, planDate: day || null, source: source || null, description: desc }),
              () => { setDesc(''); setSource('') })
          }}
        >
          <label className="text-xs text-gray-500 dark:text-slate-400">
            Gün
            <select value={day} onChange={e => setDay(e.target.value)} className={`${input} block mt-1`}>
              <option value="">Hafta</option>
              {days.map(d => <option key={d} value={d}>{dayLabel(d)}</option>)}
            </select>
          </label>
          <label className="text-xs text-gray-500 dark:text-slate-400">
            Kaynak
            <input list={listId} value={source} onChange={e => setSource(e.target.value)} placeholder="Kitap / kaynak" maxLength={120} className={`${input} block mt-1 w-40`} />
            <datalist id={listId}>{sources.map(s => <option key={s.id} value={s.name} />)}</datalist>
          </label>
          <label className="text-xs text-gray-500 dark:text-slate-400 flex-1 min-w-[12rem]">
            Talimat
            <input value={desc} onChange={e => setDesc(e.target.value)} required maxLength={300} placeholder="Türev 40 soru" className={`${input} block mt-1 w-full`} />
          </label>
          <button type="submit" disabled={pending || !desc.trim()} className="px-3 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">Ekle</button>
          {mine.length === 0 && (
            <button type="button" disabled={pending} onClick={() => run(() => copyPreviousWeekPlan({ studentId, weekStart }))}
              className="px-3 py-2 text-sm text-blue-700 dark:text-blue-300 hover:underline">Geçen haftayı kopyala</button>
          )}
        </form>
      )}

      {canWrite && (
        <details className="text-xs">
          <summary className="cursor-pointer text-gray-500 dark:text-slate-400">Kaynak defteri ({sources.length})</summary>
          <ul className="mt-1 flex flex-wrap gap-1">
            {sources.map(s => (
              <li key={s.id} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-200">
                {s.name}
                <button type="button" aria-label={`${s.name} kaynağını sil`} disabled={pending}
                  onClick={() => run(() => removeStudentSource(s.id))} className="hover:text-red-600">✕</button>
              </li>
            ))}
          </ul>
          <form className="mt-1 flex gap-1" onSubmit={e => { e.preventDefault(); run(() => addStudentSource({ studentId, name: newSource }), () => setNewSource('')) }}>
            <input value={newSource} onChange={e => setNewSource(e.target.value)} placeholder="Yeni kitap" maxLength={120} className={`${input} w-40`} aria-label="Yeni kaynak adı" />
            <button type="submit" disabled={pending || !newSource.trim()} className="px-2 py-1 rounded-lg bg-gray-200 dark:bg-slate-600 text-gray-800 dark:text-slate-100">+ Kitap ekle</button>
          </form>
        </details>
      )}
    </div>
  )
}
