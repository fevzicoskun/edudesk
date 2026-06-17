'use client'

import { useState, useMemo, useTransition } from 'react'
import { saveTeacherClassChanges } from '@/app/actions/users'
import type { UserRow, ClassRow } from './KullaniciFiltreli'

type Assignments = Map<string, Set<string>>

function toMap(record: Record<string, string[]>): Assignments {
  return new Map(Object.entries(record).map(([t, ids]) => [t, new Set(ids)]))
}

function clone(m: Assignments): Assignments {
  return new Map([...m].map(([t, s]) => [t, new Set(s)]))
}

export default function SinifAtamaMatrisi({
  teachers,
  classes,
  initialAssignments,
}: {
  teachers: UserRow[]
  classes: ClassRow[]
  initialAssignments: Record<string, string[]>
}) {
  const [baseline, setBaseline] = useState<Assignments>(() => toMap(initialAssignments))
  const [working, setWorking]   = useState<Assignments>(() => toMap(initialAssignments))
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const has = (teacherId: string, classId: string) => working.get(teacherId)?.has(classId) ?? false

  function toggle(teacherId: string, classId: string) {
    setError(null)
    setWorking(prev => {
      const next = clone(prev)
      const set = next.get(teacherId) ?? new Set<string>()
      set.has(classId) ? set.delete(classId) : set.add(classId)
      next.set(teacherId, set)
      return next
    })
  }

  // Değişen hücreler (baseline ile working farkı)
  const changes = useMemo(() => {
    const out: { teacherId: string; classId: string; assigned: boolean }[] = []
    for (const t of teachers) {
      const base = baseline.get(t.id) ?? new Set<string>()
      const work = working.get(t.id) ?? new Set<string>()
      for (const c of classes) {
        const b = base.has(c.id)
        const w = work.has(c.id)
        if (b !== w) out.push({ teacherId: t.id, classId: c.id, assigned: w })
      }
    }
    return out
  }, [teachers, classes, baseline, working])

  function save() {
    if (changes.length === 0) return
    setError(null)
    startTransition(async () => {
      const result = await saveTeacherClassChanges(changes)
      if (result.error) {
        setError(result.error)
      } else {
        setBaseline(clone(working)) // başarıda yeni baseline
      }
    })
  }

  if (teachers.length === 0) {
    return <p className="text-sm text-gray-400 dark:text-slate-500 py-4">Atanabilir öğretmen yok.</p>
  }
  if (classes.length === 0) {
    return <p className="text-sm text-gray-400 dark:text-slate-500 py-4">Henüz sınıf oluşturulmamış.</p>
  }

  return (
    <div className="space-y-3">
      <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl overflow-x-auto">
        <table className="text-sm border-collapse">
          <thead>
            <tr className="border-b border-gray-200 dark:border-slate-700">
              <th className="sticky left-0 z-10 bg-white dark:bg-slate-800 text-left px-3 py-2 font-medium text-gray-500 dark:text-slate-400 min-w-[160px]">
                Öğretmen
              </th>
              {classes.map(c => (
                <th key={c.id} className="px-2 py-2 font-medium text-gray-500 dark:text-slate-400 whitespace-nowrap text-center leading-tight">
                  {c.grade != null && <div className="text-[9px] font-normal opacity-70">{c.grade}. Sınıf</div>}
                  <div>{c.name}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50">
            {teachers.map(t => (
              <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/40">
                <td className="sticky left-0 z-10 bg-white dark:bg-slate-800 px-3 py-1.5 text-gray-800 dark:text-slate-200 whitespace-nowrap">
                  {t.full_name}
                  {t.subject && <span className="text-gray-400 dark:text-slate-500 text-xs ml-1.5">{t.subject}</span>}
                </td>
                {classes.map(c => {
                  const checked = has(t.id, c.id)
                  const dirty   = (baseline.get(t.id)?.has(c.id) ?? false) !== checked
                  return (
                    <td key={c.id} className={`text-center px-2 py-1.5 ${dirty ? 'bg-amber-50 dark:bg-amber-900/20' : ''}`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(t.id, c.id)}
                        disabled={pending}
                        className="rounded border-gray-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500 disabled:opacity-50 cursor-pointer"
                      />
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={changes.length === 0 || pending}
          className="px-4 py-2 rounded-lg text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 dark:disabled:bg-slate-700 dark:disabled:text-slate-500 transition-colors"
        >
          {pending ? 'Kaydediliyor…' : 'Kaydet'}
        </button>
        {changes.length > 0 && !pending && (
          <button
            onClick={() => { setWorking(clone(baseline)); setError(null) }}
            className="text-sm text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200 transition-colors"
          >
            Vazgeç
          </button>
        )}
        <span className="text-xs text-gray-400 dark:text-slate-500 ml-auto">
          {changes.length > 0 ? `${changes.length} değişiklik bekliyor` : 'Değişiklik yok'}
        </span>
      </div>
    </div>
  )
}
