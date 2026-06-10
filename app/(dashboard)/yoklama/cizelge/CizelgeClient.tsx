'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { getCizelge } from '@/app/actions/yoklama'
import { buildMonthGrid, countAbsences } from '@/src/domains/attendance/lib/attendanceMath'
import { ATTENDANCE_WARN_DAYS, ATTENDANCE_LIMIT_DAYS } from '@/src/shared/constants/attendance'
import type { AttendanceStatus } from '@/src/domains/attendance/types'
import StudentAttendanceHistory from '@/components/student/StudentAttendanceHistory'
import YoklamaExcelButton from './YoklamaExcelButton'

interface Student  { id: string; full_name: string; student_number: string | null }
interface ClassItem { id: string; name: string; students: Student[] }
type AbsenceCounts = ReturnType<typeof countAbsences>

const CELL: Record<string, { ch: string; cls: string }> = {
  present: { ch: '·', cls: 'text-gray-300 dark:text-slate-600' },
  absent:  { ch: 'D', cls: 'text-red-600 dark:text-red-400 font-bold' },
  late:    { ch: 'G', cls: 'text-yellow-600 dark:text-yellow-400 font-bold' },
  excused: { ch: 'Ö', cls: 'text-blue-600 dark:text-blue-400 font-bold' },
}

const DAY_ABBR = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt']

function todayISTStr() {
  return new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Istanbul' }).format(new Date())
}

export default function CizelgeClient({ classes, yearCounts }: { classes: ClassItem[]; yearCounts: AbsenceCounts }) {
  const [todayStr] = useState(todayISTStr)  // mount'ta bir kez, Intl.DateTimeFormat maliyeti atlanır
  const [todayYear, todayMonth] = todayStr.split('-').map(Number)
  const [classId, setClassId] = useState(classes[0]?.id ?? '')
  const [ym, setYm] = useState(`${todayYear}-${String(todayMonth).padStart(2, '0')}`)
  const [days, setDays] = useState<string[]>([])
  const [grid, setGrid] = useState<Record<string, Record<string, AttendanceStatus>>>({})
  const [counts, setCounts] = useState<ReturnType<typeof countAbsences>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [openStudent, setOpenStudent] = useState<Student | null>(null)

  const [year, month] = ym.split('-').map(Number)
  const cls = classes.find(c => c.id === classId)

  const schoolYearStartYm = `${todayMonth >= 9 ? todayYear : todayYear - 1}-09`
  const currentYm         = `${todayYear}-${String(todayMonth).padStart(2, '0')}`

  const dangerStudents = useMemo(
    () => (cls ? cls.students.filter(s => (yearCounts[s.id]?.unexcused ?? 0) >= ATTENDANCE_LIMIT_DAYS).length : 0),
    [cls, yearCounts]
  )
  const warnStudents = useMemo(
    () => (cls ? cls.students.filter(s => {
      const u = yearCounts[s.id]?.unexcused ?? 0
      return u >= ATTENDANCE_WARN_DAYS && u < ATTENDANCE_LIMIT_DAYS
    }).length : 0),
    [cls, yearCounts]
  )

  const load = useCallback(async () => {
    if (!classId) return
    setLoading(true)
    setError('')
    try {
      const { days: d, rows } = await getCizelge(classId, year, month)
      setDays(d)
      setGrid(buildMonthGrid(rows))
      setCounts(countAbsences(rows))
    } catch (e) {
      console.error('[CizelgeClient] load:', e)
      setError(e instanceof Error ? e.message : 'Çizelge yüklenemedi')
    } finally {
      setLoading(false)
    }
  }, [classId, year, month])

  useEffect(() => { load() }, [load])

  const inputCls = 'px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-base bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500'

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Sınıf</label>
          <select value={classId} onChange={e => setClassId(e.target.value)} className={inputCls}>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Ay</label>
          <input type="month" value={ym} onChange={e => e.target.value && setYm(e.target.value)} min={schoolYearStartYm} max={currentYm} className={inputCls} />
        </div>
        <div className="ml-auto">
          {cls && days.length > 0 && (
            <YoklamaExcelButton
              classId={classId}
              className={cls.name}
              since={days[0]}
              until={days[days.length - 1]}
            />
          )}
        </div>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {(dangerStudents > 0 || warnStudents > 0) && (
        <div className="flex flex-wrap gap-2">
          {dangerStudents > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300">
              <span className="font-bold">⚠</span>
              <span><strong>{dangerStudents}</strong> öğrenci MEB sınırını aştı ({ATTENDANCE_LIMIT_DAYS}+ özürsüz gün)</span>
            </div>
          )}
          {warnStudents > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-amber-700 dark:text-amber-300">
              <span className="font-semibold">!</span>
              <span><strong>{warnStudents}</strong> öğrenci uyarı bölgesinde ({ATTENDANCE_WARN_DAYS}+ özürsüz gün)</span>
            </div>
          )}
        </div>
      )}

      <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl overflow-x-auto">
        {loading ? (
          <p className="p-6 text-center text-sm text-gray-400">Yükleniyor…</p>
        ) : !cls || cls.students.length === 0 ? (
          <p className="p-6 text-center text-sm text-gray-400">Bu sınıfta öğrenci yok.</p>
        ) : (
          <table className="text-xs w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-slate-700">
                <th className="sticky left-0 bg-white dark:bg-slate-800 text-left px-3 py-2 font-medium text-gray-500 dark:text-slate-400 min-w-[160px]">
                  Öğrenci
                </th>
                {days.map(d => {
                  const [y, m, day] = d.split('-').map(Number)
                  const dow = new Date(y, m - 1, day).getDay()
                  const isToday = d === todayStr
                  return (
                    <th
                      key={d}
                      className={`px-1 py-1.5 font-medium tabular-nums text-center leading-tight ${
                        isToday
                          ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-t'
                          : 'text-gray-400 dark:text-slate-500'
                      }`}
                    >
                      <div className="text-[9px] font-normal opacity-70">{DAY_ABBR[dow]}</div>
                      <div>{day}</div>
                    </th>
                  )
                })}
                <th className="px-2 py-2 font-medium text-gray-500 dark:text-slate-400 whitespace-nowrap text-right">
                  <div>Özürsüz | Özürlü</div>
                  <div className="text-[9px] font-normal opacity-60">bu ay | yıllık</div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50">
              {cls.students.map(s => {
                const c      = counts[s.id]     ?? { unexcused: 0, excused: 0 }
                const yc     = yearCounts[s.id] ?? { unexcused: 0, excused: 0 }
                const isDanger = yc.unexcused >= ATTENDANCE_LIMIT_DAYS
                const isWarn   = !isDanger && yc.unexcused >= ATTENDANCE_WARN_DAYS
                const rowBg    = isDanger
                  ? 'bg-red-50 dark:bg-red-900/10 hover:bg-red-100 dark:hover:bg-red-900/20'
                  : isWarn
                  ? 'bg-amber-50 dark:bg-amber-900/10 hover:bg-amber-100 dark:hover:bg-amber-900/20'
                  : 'hover:bg-gray-50 dark:hover:bg-slate-700/40'
                const stickyBg = isDanger
                  ? 'bg-red-50 dark:bg-red-900/10'
                  : isWarn
                  ? 'bg-amber-50 dark:bg-amber-900/10'
                  : 'bg-white dark:bg-slate-800'
                return (
                  <tr
                    key={s.id}
                    className={`cursor-pointer ${rowBg}`}
                    onClick={() => setOpenStudent(s)}
                  >
                    <td className={`sticky left-0 px-3 py-1.5 text-gray-800 dark:text-slate-200 whitespace-nowrap ${stickyBg}`}>
                      <span className="flex items-center gap-1.5">
                        {(isDanger || isWarn) && (
                          <span className={`text-[10px] font-bold ${isDanger ? 'text-red-500' : 'text-amber-500'}`}>
                            {isDanger ? '⚠' : '!'}
                          </span>
                        )}
                        {s.full_name}
                        {s.student_number ? <span className="text-gray-400 ml-1">#{s.student_number}</span> : null}
                      </span>
                    </td>
                    {days.map(d => {
                      const st = grid[s.id]?.[d]
                      const cell = st ? CELL[st] : undefined
                      const isToday = d === todayStr
                      return (
                        <td
                          key={d}
                          className={`text-center px-1 py-1.5 ${cell?.cls ?? 'text-gray-200 dark:text-slate-700'} ${isToday ? 'bg-blue-50/60 dark:bg-blue-900/10' : ''}`}
                        >
                          {cell?.ch ?? ''}
                        </td>
                      )
                    })}
                    <td className="text-right px-2 py-1.5 tabular-nums whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1 text-xs">
                        <span className={c.unexcused > 0 ? 'text-red-500 dark:text-red-400' : 'text-gray-400'}>
                          {c.unexcused}
                        </span>
                        <span className="text-gray-300 dark:text-slate-600">|</span>
                        <span className={c.excused > 0 ? 'text-blue-500 dark:text-blue-400' : 'text-gray-400'}>
                          {c.excused}
                        </span>
                      </div>
                      <div className={`text-[10px] text-right font-semibold ${isDanger ? 'text-red-600 dark:text-red-400' : isWarn ? 'text-amber-600 dark:text-amber-400' : yc.unexcused > 0 ? 'text-gray-500 dark:text-slate-400' : 'text-gray-300 dark:text-slate-600'}`}>
                        {yc.unexcused > 0 ? `${yc.unexcused}g yıllık` : ''}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {openStudent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) setOpenStudent(null) }}
        >
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-slate-700">
              <h2 className="font-semibold text-gray-900 dark:text-slate-100">
                {openStudent.full_name} — Devamsızlık
              </h2>
              <button
                onClick={() => setOpenStudent(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 text-xl leading-none px-2"
              >
                ×
              </button>
            </div>
            <div className="overflow-y-auto px-4 py-2">
              <StudentAttendanceHistory studentId={openStudent.id} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
