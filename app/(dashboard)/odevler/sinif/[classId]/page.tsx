import { createClient } from '@/src/infrastructure/supabase/server'
import { getCurrentProfile } from '@/src/shared/auth'
import { notFound, redirect } from 'next/navigation'
import { isTeachingRole, isMudurOrAbove } from '@/src/shared/types'
import Link from 'next/link'
import PrintButton from '@/components/PrintButton'
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

export default async function SinifMatrisPage({
  params,
}: {
  params: Promise<{ classId: string }>
}) {
  const { classId } = await params
  const profile = await getCurrentProfile()
  if (!profile?.school_id) redirect('/login')

  const canSee = isTeachingRole(profile.role) || isMudurOrAbove(profile.role)
  if (!canSee) redirect('/odevler')

  const supabase = await createClient()
  const sid = profile.school_id

  const [clsRes, studentsRes, homeworksRes] = await Promise.all([
    supabase.from('classes').select('name, grade').eq('id', classId).eq('school_id', sid).single(),
    supabase
      .from('students')
      .select('id, full_name, student_number')
      .eq('class_id', classId)
      .eq('school_id', sid)
      .is('deleted_at', null)
      .order('student_number'),
    supabase
      .from('homeworks')
      .select('id, title, subject, due_date')
      .eq('class_id', classId)
      .eq('school_id', sid)
      .is('deleted_at', null)
      .eq('is_template', false)
      .order('due_date', { ascending: false })
      .limit(30),
  ])

  if (!clsRes.data) notFound()

  const students  = studentsRes.data  ?? []
  const homeworks = homeworksRes.data ?? []

  const hwIds = homeworks.map(h => h.id)
  const { data: rawSubs } = hwIds.length > 0
    ? await supabase
        .from('homework_submissions')
        .select('homework_id, student_id, status')
        .in('homework_id', hwIds)
        .eq('school_id', sid)
    : { data: [] as { homework_id: string; student_id: string; status: string }[] }

  const subMap = new Map<string, SubmissionStatus>()
  for (const s of rawSubs ?? []) {
    subMap.set(`${s.student_id}_${s.homework_id}`, s.status as SubmissionStatus)
  }

  // Öğrenci başına tamamlanma istatistiği
  function studentStats(studentId: string) {
    let done = 0, eligible = 0
    for (const hw of homeworks) {
      const s = subMap.get(`${studentId}_${hw.id}`)
      if (!s || s === 'mazeretli') continue
      eligible++
      if (s === 'yapildi') done++
    }
    return { done, eligible, pct: eligible === 0 ? null : Math.round(done / eligible * 100) }
  }

  // Ödev başına tamamlanma istatistiği
  function homeworkStats(hwId: string) {
    let done = 0, eligible = 0
    for (const st of students) {
      const s = subMap.get(`${st.id}_${hwId}`)
      if (!s || s === 'mazeretli') continue
      eligible++
      if (s === 'yapildi') done++
    }
    return { done, eligible, pct: eligible === 0 ? null : Math.round(done / eligible * 100) }
  }

  const cls = clsRes.data

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-50 via-indigo-50/10 to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="p-4 md:p-6">

        {/* Header */}
        <div className="flex items-center justify-between mb-6 print:hidden">
          <div className="flex items-center gap-3">
            <Link
              href="/odevler"
              className="flex items-center justify-center w-9 h-9 rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-500 hover:text-gray-800 shadow-sm transition-all"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div>
              <h1 className="text-lg font-bold text-gray-900 dark:text-slate-100">
                {cls.name} — Ödev Matrisi
              </h1>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                {students.length} öğrenci · Son {homeworks.length} ödev
              </p>
            </div>
          </div>
          <PrintButton />
        </div>

        {homeworks.length === 0 || students.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <p className="text-gray-500 dark:text-slate-400 font-medium">
              {homeworks.length === 0 ? 'Bu sınıfa henüz ödev atanmamış.' : 'Bu sınıfta henüz öğrenci yok.'}
            </p>
            <Link href="/odevler" className="mt-4 text-sm text-blue-600 hover:underline">← Ödevlere dön</Link>
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="text-xs border-collapse min-w-full">
                <thead>
                  <tr className="bg-gray-50 dark:bg-slate-900/50">
                    {/* Öğrenci kolonu başlığı */}
                    <th className="sticky left-0 z-10 bg-gray-50 dark:bg-slate-900/50 border-b border-r border-gray-200 dark:border-slate-700 px-3 py-3 text-left font-semibold text-gray-600 dark:text-slate-400 min-w-[180px]">
                      Öğrenci
                    </th>
                    {/* Ödev kolonları */}
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
                    {/* Tamamlanma kolonu */}
                    <th className="border-b border-gray-200 dark:border-slate-700 px-3 py-3 text-center font-semibold text-gray-600 dark:text-slate-400 min-w-[60px]">
                      Oran
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((student, si) => {
                    const { done, eligible, pct } = studentStats(student.id)
                    return (
                      <tr key={student.id} className={si % 2 === 0 ? '' : 'bg-gray-50/40 dark:bg-slate-900/20'}>
                        {/* Öğrenci adı (yapışık) */}
                        <td className={`sticky left-0 z-10 border-r border-b border-gray-200 dark:border-slate-700 px-3 py-2 font-medium text-gray-800 dark:text-slate-200 ${si % 2 === 0 ? 'bg-white dark:bg-slate-800' : 'bg-gray-50/70 dark:bg-slate-800/80'}`}>
                          <div className="flex items-center gap-2 min-w-0">
                            {student.student_number && (
                              <span className="text-[10px] text-gray-400 dark:text-slate-500 shrink-0 w-6 text-right">{student.student_number}</span>
                            )}
                            <span className="truncate max-w-[130px]">{student.full_name}</span>
                          </div>
                        </td>
                        {/* Statü hücreleri */}
                        {homeworks.map(hw => {
                          const key    = `${student.id}_${hw.id}`
                          const status = subMap.get(key)
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
                        {/* Tamamlanma oranı */}
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
                {/* Ödev başına özet satırı */}
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

            {/* Renk açıklaması */}
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
        )}
      </div>
    </div>
  )
}
