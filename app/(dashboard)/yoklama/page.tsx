import { createClient } from '@/src/infrastructure/supabase/server'
import { getCurrentUser, getCurrentProfile } from '@/src/shared/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import YoklamaBoard from './YoklamaBoard'
import YoklamaGecmis from './YoklamaGecmis'
import PrintButton from '@/components/PrintButton'
import type { AttendanceStatus } from '@/src/domains/attendance/types'
import { schoolYearStart } from '@/src/shared/utils'

export const revalidate = 0


function last14Days(): string[] {
  return Array.from({ length: 14 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (13 - i))
    return d.toISOString().split('T')[0]
  })
}

type Tab = 'yoklama' | 'gecmis'

export default async function YoklamaPage({
  searchParams,
}: {
  searchParams: Promise<{ classId?: string; tab?: string }>
}) {
  const { classId, tab: tabParam } = await searchParams
  const tab: Tab = tabParam === 'gecmis' ? 'gecmis' : 'yoklama'

  const [user, profile] = await Promise.all([getCurrentUser(), getCurrentProfile()])
  if (!user) redirect('/login')
  const schoolId = profile?.school_id ?? ''

  const supabase = await createClient()
  const today = new Date().toISOString().split('T')[0]

  const [{ data: classes }, tableProbe] = await Promise.all([
    supabase.from('classes').select('id, name, grade').eq('school_id', schoolId).order('grade').order('name'),
    supabase.from('attendance').select('id').limit(1),
  ])

  const selectedId = classId ?? classes?.[0]?.id
  const selectedClass = classes?.find(c => c.id === selectedId)
  let tableExists = tableProbe.error?.code !== '42P01'

  let students: { id: string; full_name: string; student_number: string | null }[] = []
  let existing: Record<string, AttendanceStatus> = {}
  let allRecords: { student_id: string; date: string; status: string }[] = []

  if (tableExists && selectedId) {
    const probeRes = await supabase
      .from('attendance')
      .select('student_id, status')
      .eq('class_id', selectedId)
      .eq('school_id', schoolId)
      .eq('date', today)

    const studentsRes = await supabase
      .from('students')
      .select('id, full_name, student_number')
      .eq('class_id', selectedId)
      .eq('school_id', schoolId)
      .order('student_number', { nullsFirst: false })
      .order('full_name')

    students = studentsRes.data ?? []

    if (tab === 'yoklama') {
      for (const r of probeRes.data ?? []) {
        existing[r.student_id] = r.status as AttendanceStatus
      }
    } else {
      const histRes = await supabase
        .from('attendance')
        .select('student_id, date, status')
        .eq('class_id', selectedId)
        .eq('school_id', schoolId)
        .gte('date', schoolYearStart())
        .order('date', { ascending: false })

      allRecords = histRes.data ?? []
    }
  }

  const gridDates = last14Days()

  const classLink = (cls: { id: string }) =>
    `/yoklama?classId=${cls.id}&tab=${tab}`

  const tabLink = (t: Tab) =>
    selectedId ? `/yoklama?classId=${selectedId}&tab=${t}` : `/yoklama?tab=${t}`

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="mb-5 flex items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">Yoklama</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">Günlük devam takibi ve devamsızlık istatistikleri</p>
        </div>
        <PrintButton />
      </div>

      {!tableExists ? (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-5">
          <h2 className="font-semibold text-yellow-800 dark:text-yellow-300 mb-2">Yoklama modülü henüz etkinleştirilmemiş</h2>
          <p className="text-sm text-yellow-700 dark:text-yellow-400">
            Lütfen sistem yöneticinizle iletişime geçin.
          </p>
        </div>
      ) : (
        <>
          {/* Tab bar */}
          <div className="flex overflow-x-auto border-b border-gray-200 dark:border-slate-700 mb-5">
            {([
              { key: 'yoklama', label: 'Yoklama Al' },
              { key: 'gecmis',  label: 'Geçmiş & Devamsızlık' },
            ] as { key: Tab; label: string }[]).map(({ key, label }) => (
              <Link
                key={key}
                href={tabLink(key)}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap shrink-0 ${
                  tab === key
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 hover:border-gray-300'
                }`}
              >
                {label}
              </Link>
            ))}
          </div>

          {/* Sınıf seçimi */}
          <div className="flex flex-wrap gap-2 mb-5">
            {(classes ?? []).map(c => (
              <Link
                key={c.id}
                href={classLink(c)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  c.id === selectedId
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:border-blue-300'
                }`}
              >
                {c.name}
              </Link>
            ))}
          </div>

          {!selectedClass ? (
            <p className="text-center py-12 text-gray-400 text-sm">Sınıf seçin veya önce sınıf ekleyin.</p>
          ) : tab === 'yoklama' ? (
            <YoklamaBoard
              students={students}
              classId={selectedId!}
              className={selectedClass.name}
              todayStr={today}
              existing={existing}
            />
          ) : (
            <YoklamaGecmis
              students={students}
              allRecords={allRecords}
              gridDates={gridDates}
              className={selectedClass.name}
            />
          )}
        </>
      )}
    </div>
  )
}
