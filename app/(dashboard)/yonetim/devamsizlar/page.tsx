import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/src/infrastructure/supabase/server'
import { getCurrentProfile } from '@/src/shared/auth'
import { format } from '@/src/shared/date'

export const revalidate = 0

export default async function DevamsizlarPage() {
  const profile = await getCurrentProfile()
  if (!profile || !['mudur', 'mudur_yardimcisi'].includes(profile.role ?? '')) redirect('/anasayfa')

  const supabase = await createClient()
  const today = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const todayStr   = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`
  const monthStart = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-01`

  const [todayRes, monthRes] = await Promise.all([
    supabase
      .from('attendance')
      .select('student_id, status, students(full_name, student_number), classes(name, grade)')
      .eq('school_id', profile.school_id!)
      .eq('date', todayStr)
      .in('status', ['absent', 'late'])
      .order('status'),
    supabase
      .from('attendance')
      .select('student_id')
      .eq('school_id', profile.school_id!)
      .gte('date', monthStart)
      .lte('date', todayStr)
      .in('status', ['absent', 'late']),
  ])

  type Row = {
    student_id: string
    status: string
    students: { full_name: string; student_number: string | null } | null
    classes: { name: string; grade: number } | null
  }
  const rows = (todayRes.data ?? []) as unknown as Row[]

  // Bu ay her öğrencinin kaç kez devamsız/geç kaldığı
  const monthlyCount = new Map<string, number>()
  for (const a of monthRes.data ?? []) {
    monthlyCount.set(a.student_id, (monthlyCount.get(a.student_id) ?? 0) + 1)
  }

  const byClass = rows.reduce<Record<string, { rows: typeof rows; grade: number }>>((acc, row) => {
    const key = row.classes?.name ?? 'Bilinmeyen'
    if (!acc[key]) acc[key] = { rows: [], grade: row.classes?.grade ?? 999 }
    acc[key].rows.push(row)
    return acc
  }, {})

  const sortedClasses = Object.entries(byClass)
    .sort(([nameA, a], [nameB, b]) => a.grade - b.grade || nameA.localeCompare(nameB, 'tr'))

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <Link
          href="/anasayfa"
          className="text-gray-400 hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-300"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">Bugünkü Devamsızlar</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
            {format(new Date(), 'd MMMM yyyy, EEEE')} · {rows.length} öğrenci
          </p>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-900 p-6 text-center">
          <p className="text-emerald-700 dark:text-emerald-300 font-medium">Bugün devamsız öğrenci yok</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sortedClasses.map(([className, { rows: classRows }]) => (
            <div key={className} className="rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
              <div className="px-4 py-2.5 bg-gray-50 dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-700 dark:text-slate-300">{className}</span>
                <span className="text-xs text-gray-500 dark:text-slate-400">{classRows.length} kişi</span>
              </div>
              <ul className="divide-y divide-gray-100 dark:divide-slate-800">
                {classRows.map(row => {
                  const aylikSayi = monthlyCount.get(row.student_id) ?? 0
                  const kronik = aylikSayi >= 5
                  return (
                    <li key={row.student_id} className="flex items-center justify-between px-4 py-3 gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-slate-100">
                          {row.students?.full_name ?? '—'}
                        </p>
                        {row.students?.student_number && (
                          <p className="text-xs text-gray-400 dark:text-slate-500">No: {row.students.student_number}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                          kronik
                            ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900'
                            : 'bg-gray-50 text-gray-500 border-gray-200 dark:bg-slate-700 dark:text-slate-400 dark:border-slate-600'
                        }`}>
                          Bu ay: {aylikSayi}. devamsızlık
                        </span>
                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                          row.status === 'absent'
                            ? 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300'
                            : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950/50 dark:text-yellow-300'
                        }`}>
                          {row.status === 'absent' ? 'Devamsız' : 'Geç'}
                        </span>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
