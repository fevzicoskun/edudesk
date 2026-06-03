'use client'

import { useState } from 'react'
import Link from 'next/link'
import { format, parseISO } from '@/src/shared/date'

type SubmissionStatus = 'yapildi' | 'eksik' | 'yapilmadi' | 'gec' | 'mazeretli'

const STATUS_LABEL: Record<SubmissionStatus, string> = {
  yapildi: 'Yapıldı', eksik: 'Eksik', yapilmadi: 'Yapılmadı', gec: 'Geç', mazeretli: 'Mazeretli',
}

const CELL_CLS: Record<SubmissionStatus, string> = {
  yapildi:   'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400',
  eksik:     'bg-amber-100  text-amber-700  dark:bg-amber-900/40  dark:text-amber-400',
  yapilmadi: 'bg-red-100    text-red-700    dark:bg-red-900/40    dark:text-red-400',
  gec:       'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400',
  mazeretli: 'bg-slate-100  text-slate-600  dark:bg-slate-700     dark:text-slate-400',
}

const CELL_DOT: Record<SubmissionStatus, string> = {
  yapildi: '✓', eksik: '~', yapilmadi: '✗', gec: 'G', mazeretli: 'M',
}

function dueDateFmt(d: string | null) {
  if (!d) return '—'
  try { return format(parseISO(d), 'd MMM') } catch { return d }
}

function completionColor(pct: number) {
  if (pct >= 80) return 'text-emerald-600 dark:text-emerald-400'
  if (pct >= 50) return 'text-amber-600 dark:text-amber-400'
  return 'text-red-500 dark:text-red-400'
}

type Student  = { id: string; full_name: string; student_number: string | null }
type Homework = { id: string; title: string; subject: string; due_date: string | null }

type Props = {
  students:  Student[]
  homeworks: Homework[]
  subMap:    Record<string, SubmissionStatus>
}

export default function MatrisClient({ students, homeworks, subMap }: Props) {
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<'number' | 'pct_desc' | 'pct_asc'>('number')

  function studentStats(studentId: string) {
    let done = 0, eligible = 0
    for (const hw of homeworks) {
      const s = subMap[`${studentId}_${hw.id}`]
      if (!s || s === 'mazeretli') continue
      eligible++
      if (s === 'yapildi') done++
    }
    return { done, eligible, pct: eligible === 0 ? null : Math.round(done / eligible * 100) }
  }

  function homeworkStats(hwId: string) {
    let done = 0, eligible = 0
    for (const st of students) {
      const s = subMap[`${st.id}_${hwId}`]
      if (!s || s === 'mazeretli') continue
      eligible++
      if (s === 'yapildi') done++
    }
    return { done, eligible, pct: eligible === 0 ? null : Math.round(done / eligible * 100) }
  }

  const q = search.trim().toLowerCase()

  const filteredStudents = q
    ? students.filter(s =>
        s.full_name.toLowerCase().includes(q) ||
        (s.student_number ?? '').toLowerCase().includes(q)
      )
    : students

  const sortedStudents = [...filteredStudents].sort((a, b) => {
    if (sortBy === 'number') {
      return (a.student_number ?? '').localeCompare(b.student_number ?? '', undefined, { numeric: true })
    }
    const ap = studentStats(a.id).pct
    const bp = studentStats(b.id).pct
    if (ap === null && bp === null) return 0
    if (ap === null) return 1
    if (bp === null) return -1
    return sortBy === 'pct_desc' ? bp - ap : ap - bp
  })

  const showControls = students.length > 6

  return (
    <>
      {showControls && (
        <div className="flex flex-wrap items-center gap-3 mb-4 print:hidden">
          <div className="relative flex-1 min-w-[180px]">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
            </svg>
            <input
              type="text"
              placeholder="Öğrenci ara..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm text-gray-700 dark:text-slate-300 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/10 placeholder:text-gray-400 transition-all"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as typeof sortBy)}
            className="py-2 px-3 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm text-gray-700 dark:text-slate-300 focus:outline-none focus:border-blue-400 transition-all"
          >
            <option value="number">Numara sırası</option>
            <option value="pct_desc">Tamamlanma ↓ (en başarılı)</option>
            <option value="pct_asc">Tamamlanma ↑ (en riskli)</option>
          </select>
        </div>
      )}

      {q && (
        <p className="text-xs text-gray-400 mb-3 print:hidden">
          {sortedStudents.length === 0
            ? 'Sonuç bulunamadı.'
            : `${sortedStudents.length} / ${students.length} öğrenci gösteriliyor`}
        </p>
      )}

      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="text-xs border-collapse min-w-full">
            <thead>
              <tr className="bg-gray-50 dark:bg-slate-900/50">
                <th className="sticky left-0 z-10 bg-gray-50 dark:bg-slate-900/50 border-b border-r border-gray-200 dark:border-slate-700 px-3 py-3 text-left font-semibold text-gray-600 dark:text-slate-400 min-w-[180px]">
                  Öğrenci
                </th>
                {homeworks.map(hw => (
                  <th key={hw.id} className="border-b border-r border-gray-200 dark:border-slate-700 px-2 py-2 text-center font-medium text-gray-500 dark:text-slate-500 min-w-[52px] max-w-[64px]">
                    <Link
                      href={`/odevler/${hw.id}`}
                      className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                      title={hw.title}
                    >
                      <div className="text-[10px] font-bold text-gray-700 dark:text-slate-300 leading-tight truncate max-w-[56px]">
                        {hw.subject ?? '—'}
                      </div>
                      <div className="text-[10px] text-gray-400 dark:text-slate-500 mt-0.5">
                        {dueDateFmt(hw.due_date)}
                      </div>
                    </Link>
                  </th>
                ))}
                <th className="border-b border-gray-200 dark:border-slate-700 px-3 py-3 text-center font-semibold text-gray-600 dark:text-slate-400 min-w-[60px]">
                  Oran
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedStudents.map((student, si) => {
                const { done, eligible, pct } = studentStats(student.id)
                return (
                  <tr key={student.id} className={si % 2 === 0 ? '' : 'bg-gray-50/40 dark:bg-slate-900/20'}>
                    <td className={`sticky left-0 z-10 border-r border-b border-gray-200 dark:border-slate-700 px-3 py-2 font-medium text-gray-800 dark:text-slate-200 ${si % 2 === 0 ? 'bg-white dark:bg-slate-800' : 'bg-gray-50/70 dark:bg-slate-800/80'}`}>
                      <div className="flex items-center gap-2 min-w-0">
                        {student.student_number && (
                          <span className="text-[10px] text-gray-400 dark:text-slate-500 shrink-0 w-6 text-right">{student.student_number}</span>
                        )}
                        <span className="truncate max-w-[130px]">{student.full_name}</span>
                      </div>
                    </td>
                    {homeworks.map(hw => {
                      const status = subMap[`${student.id}_${hw.id}`]
                      return (
                        <td key={hw.id} className="border-r border-b border-gray-100 dark:border-slate-700/60 p-1 text-center">
                          {status ? (
                            <span
                              title={STATUS_LABEL[status]}
                              className={`inline-flex items-center justify-center w-7 h-7 rounded-lg text-[11px] font-bold ${CELL_CLS[status]}`}
                            >
                              {CELL_DOT[status]}
                            </span>
                          ) : (
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-gray-50 dark:bg-slate-700/40 text-gray-300 dark:text-slate-600 text-[10px]">·</span>
                          )}
                        </td>
                      )
                    })}
                    <td className="border-b border-gray-200 dark:border-slate-700 px-2 py-2 text-center">
                      {pct === null ? (
                        <span className="text-gray-300 dark:text-slate-600">—</span>
                      ) : (
                        <span className={`font-bold ${completionColor(pct)}`}>%{pct}</span>
                      )}
                      {eligible > 0 && (
                        <div className="text-[10px] text-gray-400 dark:text-slate-500">{done}/{eligible}</div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 dark:bg-slate-900/50 border-t-2 border-gray-300 dark:border-slate-600">
                <td className="sticky left-0 z-10 bg-gray-50 dark:bg-slate-900/50 border-r border-gray-200 dark:border-slate-700 px-3 py-2 font-semibold text-gray-600 dark:text-slate-400 text-[11px]">
                  Sınıf ortalaması
                </td>
                {homeworks.map(hw => {
                  const { pct } = homeworkStats(hw.id)
                  return (
                    <td key={hw.id} className="border-r border-gray-200 dark:border-slate-700 px-2 py-2 text-center">
                      {pct === null ? (
                        <span className="text-gray-300 dark:text-slate-600 text-[10px]">—</span>
                      ) : (
                        <span className={`font-bold text-[11px] ${completionColor(pct)}`}>%{pct}</span>
                      )}
                    </td>
                  )
                })}
                <td className="px-2 py-2" />
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="flex flex-wrap gap-3 px-4 py-3 border-t border-gray-100 dark:border-slate-700 print:hidden">
          {(Object.entries(CELL_DOT) as [SubmissionStatus, string][]).map(([s, dot]) => (
            <span key={s} className="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-slate-400">
              <span className={`inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-bold ${CELL_CLS[s]}`}>{dot}</span>
              {STATUS_LABEL[s]}
            </span>
          ))}
          <span className="flex items-center gap-1.5 text-[11px] text-gray-400 dark:text-slate-500">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-gray-50 dark:bg-slate-700/40 text-gray-300 dark:text-slate-600">·</span>
            Girilmedi
          </span>
        </div>
      </div>
    </>
  )
}
