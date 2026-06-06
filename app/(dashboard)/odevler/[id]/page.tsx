import { createClient } from '@/src/infrastructure/supabase/server'
import { getCurrentProfile, getCurrentUser } from '@/src/shared/auth'
import { notFound, redirect } from 'next/navigation'
import { getClassWeekLoad } from '@/app/actions/homework'
import type { ClassWeekLoad } from '@/src/domains/homework/lib/week-load'
import Link from 'next/link'
import StatusBoard from './StatusBoard'
import PrintButton from '@/components/PrintButton'
import { format, parseISO } from '@/src/shared/date'
import { isTeachingRole, isMudurOrAbove } from '@/src/shared/types'
import type { SubmissionStatus } from '@/src/shared/types'

export const revalidate = 30

export default async function OdevDetayPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ guncellendi?: string }>
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams])
  const [profile, user] = await Promise.all([getCurrentProfile(), getCurrentUser()])
  if (!profile?.school_id || !user) redirect('/login')

  const supabase = await createClient()

  const { data: hw } = await supabase
    .from('homeworks')
    .select('*, classes(name)')
    .eq('id', id)
    .eq('school_id', profile.school_id)
    .is('deleted_at', null)
    .single()

  if (!hw || hw.is_template) notFound()

  // Yetki kontrolü weekLoad fetch'inden önce — erişim yoksa veri çekilmez
  const isManager = profile.role === 'zumre_baskani' || isMudurOrAbove(profile.role)
  if (!isManager && hw.teacher_id !== user.id) notFound()

  const canWrite = isTeachingRole(profile.role)

  const weekLoadResult = hw.due_date
    ? await getClassWeekLoad([hw.class_id as string], hw.due_date)
    : []
  const weekLoad: ClassWeekLoad | null = weekLoadResult[0] ?? null

  // Kümülatif sorgu için önce diğer ödev ID'lerini al
  const otherHomeworkIds = (await supabase
    .from('homeworks')
    .select('id')
    .eq('class_id', hw.class_id)
    .eq('school_id', profile.school_id)
    .is('deleted_at', null)
    .eq('is_template', false)
    .neq('id', id)
  ).data?.map(h => h.id) ?? []

  const [studentsResult, subsResult, cumulativeResult] = await Promise.all([
    supabase
      .from('students')
      .select('id, full_name, student_number, veli_telefon, veli_ad, veli_email')
      .eq('class_id', hw.class_id)
      .eq('school_id', profile.school_id)
      .is('deleted_at', null),
    supabase.from('homework_submissions').select('student_id, status, note').eq('homework_id', id).eq('school_id', profile.school_id),
    otherHomeworkIds.length > 0
      ? supabase
          .from('homework_submissions')
          .select('student_id, status, homework_id')
          .in('homework_id', otherHomeworkIds)
      : Promise.resolve({ data: [] as { student_id: string; status: string; homework_id: string }[] }),
  ])

  const students = studentsResult.data ?? []
  const subs = subsResult.data ?? []
  const subMap = new Map(subs.map((s) => [s.student_id, s]))

  // Kümülatif: öğrenci başına geçmiş ödev sicili
  const cumulativeSubs = cumulativeResult.data ?? []
  // homework_id bazında unique ödev sayısı
  const totalHomeworkCount = new Set(cumulativeSubs.map(s => s.homework_id)).size
  const missedByStudent = new Map<string, number>()
  for (const s of cumulativeSubs) {
    if (s.status === 'yapilmadi' || s.status === 'eksik') {
      missedByStudent.set(s.student_id, (missedByStudent.get(s.student_id) ?? 0) + 1)
    }
  }

  const items = students
    .map((student) => {
      const sub = subMap.get(student.id)
      return {
        student_id: student.id,
        full_name: student.full_name,
        student_number: student.student_number,
        veli_telefon: student.veli_telefon ?? null,
        veli_ad: student.veli_ad ?? null,
        veli_email: (student as typeof student & { veli_email?: string | null }).veli_email ?? null,
        status: (sub?.status ?? 'yapilmadi') as SubmissionStatus,
        note: sub?.note ?? null,
        hasRecord: !!sub,
        missedCount: missedByStudent.get(student.id) ?? 0,
        totalHomeworks: totalHomeworkCount,
      }
    })
    .sort((a, b) =>
      (a.student_number ?? '').localeCompare(b.student_number ?? '', 'tr', { numeric: true })
    )

  const cls = hw.classes as { name: string } | null

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      {sp.guncellendi && (
        <div className="mb-4 flex items-center gap-2 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-300 text-sm px-4 py-3 rounded-xl print:hidden">
          <svg className="w-4 h-4 text-green-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          Ödev başarıyla güncellendi.
        </div>
      )}
      <div className="flex items-center justify-between mb-3 print:hidden">
        <Link href="/odevler" className="text-sm text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200">
          ← Ödevler
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href={`/odevler/sinif/${hw.class_id}`}
            className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 px-2.5 py-1.5 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 14h18M10 3v18M14 3v18" />
            </svg>
            Başarı Haritası
          </Link>
          {canWrite && (
            <>
              <Link
                href={`/odevler/${id}/duzenle`}
                className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 px-2.5 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Düzenle
              </Link>
              <Link
                href={`/odevler/yeni?copy=${id}`}
                className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 px-2.5 py-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Kopyala
              </Link>
            </>
          )}
          <PrintButton />
        </div>
      </div>

      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">{hw.title}</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
          {cls?.name ?? '—'} · {hw.subject}
          {hw.due_date ? ` · Son: ${format(parseISO(hw.due_date), 'd MMMM yyyy')}` : ''}
        </p>
        {hw.description && (
          <p className="text-sm text-gray-700 dark:text-slate-300 mt-3 bg-gray-50 dark:bg-slate-800 rounded-xl p-3 border border-gray-200 dark:border-slate-700">
            {hw.description}
          </p>
        )}
      </div>

      {items.length === 0 ? (
        <p className="text-center text-gray-400 text-sm py-12">
          Bu sınıfta henüz öğrenci yok.
        </p>
      ) : (
        <>
          <StatusBoard
            homeworkId={id}
            items={items}
            homeworkTitle={hw.title}
            totalHomeworks={totalHomeworkCount}
            classId={hw.class_id}
            dueDate={hw.due_date ? format(parseISO(hw.due_date), 'd MMMM yyyy') : ''}
            className={cls?.name ?? ''}
            weekLoad={weekLoad}
          />
        </>
      )}
    </div>
  )
}
