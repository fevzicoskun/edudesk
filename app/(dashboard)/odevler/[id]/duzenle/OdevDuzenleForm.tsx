'use client'

import { useActionState, useEffect, useState } from 'react'
import { updateHomework, getClassWeekLoad } from '@/app/actions/homework'
import Link from 'next/link'
import type { ClassWeekLoad } from '@/src/domains/homework/lib/week-load'

type HwData = {
  id: string
  title: string
  subject: string
  description: string | null
  due_date: string | null
  source_id: string | null
}

type SourceItem = { id: string; name: string; subject: string | null }

const field =
  'w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-base text-gray-900 placeholder:text-gray-400 hover:border-gray-300 focus:outline-none focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 transition-all duration-200'

export default function OdevDuzenleForm({ hw, sources, classId }: { hw: HwData; sources: SourceItem[]; classId: string }) {
  const [state, formAction, isPending] = useActionState(updateHomework, null)

  const [dueDate, setDueDate]         = useState(hw.due_date ?? '')
  const [weekLoad, setWeekLoad]       = useState<ClassWeekLoad[]>([])
  const [loadingLoad, setLoadingLoad] = useState(false)

  useEffect(() => {
    if (!classId || !dueDate) { setWeekLoad([]); return }
    let active = true
    setLoadingLoad(true)
    getClassWeekLoad([classId], dueDate)
      .then(result => { if (active) { setWeekLoad(result); setLoadingLoad(false) } })
      .catch(() => { if (active) { setWeekLoad([]); setLoadingLoad(false) } })
    return () => { active = false }
  }, [classId, dueDate])

  return (
    <div className="rounded-2xl overflow-hidden bg-white shadow-xl shadow-gray-200/70 border border-gray-100/80">
      <div className="relative bg-gradient-to-br from-slate-600 via-slate-600 to-slate-700 px-6 py-5">
        <p className="text-white font-semibold text-lg">Ödevi Düzenle</p>
        <p className="text-slate-300 text-sm mt-0.5">Başlık, ders, açıklama ve tarihi güncelleyin</p>
      </div>

      <form action={formAction}>
        <input type="hidden" name="id" value={hw.id} />
        <div className="p-6 space-y-5">

          {state?.error && (
            <div className="flex items-start gap-3 bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl px-4 py-3.5">
              <svg className="w-4 h-4 mt-0.5 shrink-0 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
              {state.error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">Ders</label>
              <input name="subject" type="text" required className={field} defaultValue={hw.subject} />
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">Son Teslim Tarihi</label>
              <input
                name="due_date"
                type="date"
                className={field}
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                min={hw.due_date && hw.due_date < new Date().toISOString().split('T')[0] ? undefined : new Date().toISOString().split('T')[0]}
              />
              {hw.due_date && hw.due_date < new Date().toISOString().split('T')[0] && (
                <p className="text-xs text-amber-600">Geçmiş tarih — değiştirmek zorunda değilsiniz.</p>
              )}
            </div>
          </div>

          <WeekLoadBanner loads={weekLoad} loading={loadingLoad} />

          {sources.length > 0 && (
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Kaynak <span className="text-gray-400 font-normal normal-case tracking-normal">(opsiyonel)</span>
              </label>
              <select name="source_id" className={field} defaultValue={hw.source_id ?? ''}>
                <option value="">Kaynak seçin</option>
                {sources.map(s => (
                  <option key={s.id} value={s.id}>{s.name}{s.subject ? ` (${s.subject})` : ''}</option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-2">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">Başlık</label>
            <input name="title" type="text" required className={field} defaultValue={hw.title} />
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Açıklama <span className="text-gray-400 font-normal normal-case tracking-normal">(opsiyonel)</span>
            </label>
            <textarea
              name="description"
              rows={3}
              className={`${field} resize-none`}
              defaultValue={hw.description ?? ''}
            />
          </div>

        </div>

        <div className="px-6 py-4 bg-gray-50/70 border-t border-gray-100 flex flex-col-reverse sm:flex-row gap-3">
          <Link
            href={`/odevler/${hw.id}`}
            className="flex-1 text-center px-5 py-3 border border-gray-200 bg-white rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-all"
          >
            İptal
          </Link>
          <button
            type="submit"
            disabled={isPending}
            className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-slate-700 to-slate-800 hover:from-slate-800 hover:to-slate-900 text-white px-5 py-3 rounded-xl text-sm font-semibold shadow-lg shadow-slate-500/20 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
          >
            {isPending ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Kaydediliyor...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Kaydet
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}

function WeekLoadBanner({ loads, loading }: { loads: ClassWeekLoad[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-400">
        <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        Haftalık yük hesaplanıyor…
      </div>
    )
  }

  const worstLevel = loads.reduce<'ok' | 'warn' | 'danger'>((acc, l) => {
    if (l.level === 'danger') return 'danger'
    if (l.level === 'warn' && acc !== 'danger') return 'warn'
    return acc
  }, 'ok')

  if (loads.length === 0 || loads.every(l => l.count === 0)) return null

  const bg =
    worstLevel === 'danger' ? 'bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800' :
    worstLevel === 'warn'   ? 'bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800' :
                              'bg-gray-50 border-gray-200 dark:bg-slate-800 dark:border-slate-700'

  const titleColor =
    worstLevel === 'danger' ? 'text-red-700 dark:text-red-300' :
    worstLevel === 'warn'   ? 'text-amber-700 dark:text-amber-300' :
                              'text-gray-600 dark:text-slate-400'

  const icon =
    worstLevel === 'ok' ? (
      <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ) : (
      <svg className={`w-3.5 h-3.5 ${worstLevel === 'danger' ? 'text-red-500' : 'text-amber-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
      </svg>
    )

  return (
    <div className={`border rounded-xl px-3 py-2.5 space-y-2 ${bg}`}>
      <div className={`flex items-center gap-1.5 text-xs font-semibold ${titleColor}`}>
        {icon}
        Bu hafta:
        {worstLevel === 'danger' && ' ⚠️ Fazla yük!'}
        {worstLevel === 'warn'   && ' Dikkat: yük artıyor'}
        {worstLevel === 'ok'     && ' Yük uygun'}
      </div>
      <div className="space-y-1">
        {loads.filter(l => l.count > 0).map(l => (
          <div key={l.classId} className="text-xs">
            <span className={
              l.level === 'danger' ? 'text-red-600 dark:text-red-400 font-semibold' :
              l.level === 'warn'   ? 'text-amber-600 dark:text-amber-400 font-medium' :
                                     'text-gray-500 dark:text-slate-400'
            }>
              {l.count} ödev
            </span>
            {' — '}
            <span className="text-gray-500 dark:text-slate-400">
              {l.items.map(item =>
                `${item.subject}${!item.isOwn ? ` (${item.teacherName})` : ''}`
              ).join(', ')}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
