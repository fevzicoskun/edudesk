'use client'

import { useState, useTransition, useCallback, useEffect } from 'react'
import { setCurriculumStatus, removeCurriculumProgress, clearClassCurriculum } from '@/app/actions/zumre'
import { parseTopicString } from '@/lib/tymm-data'

type Status = 'tamamlandi' | 'tekrar_gerekli' | 'eksik_kaldi'

interface CItem {
  id: string
  class_id: string
  topic: string
  week_number: number | null
  status: string
  classes: { grade: number; name: string } | null
}

interface ClassInfo { id: string; name: string; grade: number }

interface Props {
  curriculum: CItem[]
  classes: ClassInfo[]
}

const STATUSES: Status[] = ['tamamlandi', 'tekrar_gerekli', 'eksik_kaldi']

const STATUS_LABELS: Record<Status, string> = {
  tamamlandi: 'Tamamlandı',
  tekrar_gerekli: 'Tekrar Gerekli',
  eksik_kaldi: 'Eksik Kaldı',
}

const STATUS_ACTIVE: Record<Status, string> = {
  tamamlandi: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  tekrar_gerekli: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
  eksik_kaldi: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
}

function NoteField({ id }: { id: string }) {
  const key = `mufredat_note_${id}`
  const [open, setOpen] = useState(false)
  const [val, setVal] = useState('')

  useEffect(() => {
    try { setVal(localStorage.getItem(key) ?? '') } catch {}
  }, [key])

  const save = (v: string) => {
    setVal(v)
    try { v ? localStorage.setItem(key, v) : localStorage.removeItem(key) } catch {}
  }

  return (
    <div className="mt-1.5">
      <button
        onClick={() => setOpen(o => !o)}
        className={`text-xs transition-colors ${
          val
            ? 'text-blue-600 dark:text-blue-400 font-medium'
            : 'text-gray-400 hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-300'
        }`}
      >
        {val ? '📝 Not var' : '+ not ekle'}
      </button>
      {open && (
        <textarea
          value={val}
          onChange={e => save(e.target.value)}
          placeholder="Konu hakkında not..."
          autoFocus
          rows={2}
          className="mt-1 w-full text-xs px-2 py-1.5 border border-gray-200 dark:border-slate-600 rounded-lg bg-gray-50 dark:bg-slate-800 text-gray-700 dark:text-slate-300 resize-none focus:outline-none focus:ring-1 focus:ring-blue-400"
        />
      )}
    </div>
  )
}

export default function MufredatBoard({ curriculum, classes }: Props) {
  const [, startTransition] = useTransition()
  const [overrides, setOverrides] = useState<Record<string, Status>>({})
  const [deleted, setDeleted] = useState<Set<string>>(new Set())

  const effectiveStatus = (item: CItem): Status =>
    overrides[item.id] ?? (item.status as Status)

  const changeStatus = useCallback((id: string, status: Status) => {
    setOverrides(o => ({ ...o, [id]: status }))
    startTransition(() => { setCurriculumStatus(id, status) })
  }, [startTransition])

  const remove = useCallback((id: string) => {
    setDeleted(d => { const n = new Set(d); n.add(id); return n })
    startTransition(() => { removeCurriculumProgress(id) })
  }, [startTransition])

  const clearClass = useCallback((classId: string, ids: string[]) => {
    if (!confirm('Bu sınıfın tüm konuları silinecek. Emin misin?')) return
    setDeleted(d => { const n = new Set(d); ids.forEach(id => n.add(id)); return n })
    startTransition(() => { clearClassCurriculum(classId) })
  }, [startTransition])

  const visible = curriculum.filter(c => !deleted.has(c.id))

  const total = visible.length
  const done = visible.filter(c => effectiveStatus(c) === 'tamamlandi').length
  const tekrar = visible.filter(c => effectiveStatus(c) === 'tekrar_gerekli').length
  const eksik = visible.filter(c => effectiveStatus(c) === 'eksik_kaldi').length
  const pct = total ? Math.round((done / total) * 100) : 0

  if (total === 0) return (
    <p className="text-center py-12 text-gray-400 dark:text-slate-500 text-sm">
      Henüz konu eklenmemiş.
    </p>
  )

  const classMap = new Map(classes.map(c => [c.id, c]))

  const byClass = new Map<string, CItem[]>()
  for (const item of visible) {
    if (!byClass.has(item.class_id)) byClass.set(item.class_id, [])
    byClass.get(item.class_id)!.push(item)
  }

  const sortedClassIds = [...byClass.keys()].sort((a, b) => {
    const ca = classMap.get(a)
    const cb = classMap.get(b)
    if (!ca || !cb) return 0
    return ca.grade !== cb.grade ? ca.grade - cb.grade : ca.name.localeCompare(cb.name)
  })

  return (
    <div className="space-y-4">
      {/* Genel özet */}
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700 dark:text-slate-300">Genel Müfredat Durumu</span>
          <span className="text-sm font-bold text-blue-600 dark:text-blue-400">%{pct}</span>
        </div>
        <div className="w-full bg-gray-100 dark:bg-slate-800 rounded-full h-2 mb-3">
          <div
            className="h-2 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
          <span className="text-green-600 dark:text-green-400">✅ {done} tamamlandı</span>
          <span className="text-yellow-600 dark:text-yellow-400">⚠️ {tekrar} tekrar gerekli</span>
          <span className="text-red-500 dark:text-red-400">❌ {eksik} eksik kaldı</span>
          <span className="text-gray-400 dark:text-slate-500 ml-auto">{total} konu toplam</span>
        </div>
      </div>

      {/* Sınıf bazlı listeler */}
      {sortedClassIds.map(classId => {
        const cls = classMap.get(classId)
        const items = byClass.get(classId) ?? []
        const clsName = cls?.name ?? items[0]?.classes?.name ?? '—'
        const clsDone = items.filter(c => effectiveStatus(c) === 'tamamlandi').length
        const clsPct = items.length ? Math.round((clsDone / items.length) * 100) : 0

        const byWeek = new Map<number | null, CItem[]>()
        for (const item of items) {
          const w = item.week_number
          if (!byWeek.has(w)) byWeek.set(w, [])
          byWeek.get(w)!.push(item)
        }
        const sortedWeeks = [...byWeek.keys()].sort((a, b) => {
          if (a === null) return 1
          if (b === null) return -1
          return a - b
        })

        return (
          <div key={classId} className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between bg-gray-50 dark:bg-slate-800">
              <h3 className="text-sm font-semibold text-gray-800 dark:text-slate-100">{clsName}</h3>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-20 h-1.5 bg-gray-200 dark:bg-slate-600 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 rounded-full transition-all duration-300"
                      style={{ width: `${clsPct}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-500 dark:text-slate-400">{clsDone}/{items.length}</span>
                </div>
                <button
                  onClick={() => clearClass(classId, items.map(i => i.id))}
                  className="text-xs text-red-400 hover:text-red-600 dark:hover:text-red-300 font-medium transition-colors"
                >
                  Tümünü sil
                </button>
              </div>
            </div>

            {sortedWeeks.map(week => {
              const weekItems = byWeek.get(week) ?? []
              return (
                <div key={String(week)}>
                  {week !== null && (
                    <div className="px-4 py-1.5 bg-blue-50/50 dark:bg-blue-950/20 border-b border-gray-100 dark:border-slate-800">
                      <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide">
                        Hafta {week}
                      </span>
                    </div>
                  )}
                  <div className="divide-y divide-gray-50 dark:divide-slate-800/80">
                    {weekItems.map(item => {
                      const { code, topic } = parseTopicString(item.topic)
                      const status = effectiveStatus(item)
                      return (
                        <div key={item.id} className="px-4 py-3">
                          <div className="flex flex-col sm:flex-row sm:items-start gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {code && (
                                  <span className="font-mono text-[10px] font-semibold px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 rounded shrink-0">
                                    {code}
                                  </span>
                                )}
                                <p className={`text-sm ${status === 'tamamlandi' ? 'text-gray-500 dark:text-slate-400' : 'text-gray-900 dark:text-slate-100'}`}>
                                  {topic}
                                </p>
                              </div>
                              <NoteField id={item.id} />
                            </div>
                            <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                              {STATUSES.map(s => (
                                <button
                                  key={s}
                                  onClick={() => changeStatus(item.id, s)}
                                  className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${
                                    status === s
                                      ? STATUS_ACTIVE[s]
                                      : 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-600'
                                  }`}
                                >
                                  {STATUS_LABELS[s]}
                                </button>
                              ))}
                              <button
                                onClick={() => remove(item.id)}
                                className="text-xs text-red-400 hover:text-red-600 dark:hover:text-red-300 font-medium ml-0.5 transition-colors"
                              >
                                Sil
                              </button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
