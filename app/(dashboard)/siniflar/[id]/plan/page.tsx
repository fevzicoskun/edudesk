import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/src/infrastructure/supabase/server'
import { getCurrentProfile } from '@/src/shared/auth'
import { todayLocalISO } from '@/src/shared/date'
import { weekStartOf, shiftWeek, formatWeekLabel, weekSummary } from '@/src/domains/studyPlan/planMath'
import { StudyPlanService } from '@/src/domains/studyPlan/services/StudyPlanService'
import HaftaEditoru from './HaftaEditoru'

export const metadata = { title: 'Haftalık Plan' }

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/

export default async function SinifPlanPage({
  params, searchParams,
}: { params: Promise<{ id: string }>; searchParams: Promise<{ hafta?: string }> }) {
  const { id: classId } = await params
  const { hafta } = await searchParams
  const profile = await getCurrentProfile()
  if (!profile?.school_id) redirect('/login')

  const supabase = await createClient()
  const { data: cls } = await supabase.from('classes').select('id, name').eq('id', classId).eq('school_id', profile.school_id).is('deleted_at', null).single()
  if (!cls) notFound()

  const weekStart = weekStartOf(hafta && ISO_RE.test(hafta) ? hafta : todayLocalISO())
  const { students, error } = await StudyPlanService.getClassWeek(classId, weekStart)

  // Kaynak defterleri: öğrenci başına tek sorgu yerine tüm sınıf için toplu (RLS + açık filtre, repo kuralı).
  const { data: sourceRows } = await supabase.from('student_sources').select('id, name, subject, student_id')
    .eq('school_id', profile.school_id).in('student_id', students.map(s => s.id)).eq('active', true).order('name')
  const sourcesByStudent = new Map<string, { id: string; name: string; subject: string }[]>()
  for (const s of sourceRows ?? []) {
    const arr = sourcesByStudent.get(s.student_id)
    const row = { id: s.id, name: s.name, subject: s.subject }
    if (arr) arr.push(row); else sourcesByStudent.set(s.student_id, [row])
  }

  const nav = (delta: number) => `/siniflar/${classId}/plan?hafta=${shiftWeek(weekStart, delta)}`

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <Link href={`/siniflar/${classId}`} className="text-sm text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 mb-3 inline-block">← {cls.name}</Link>
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">Haftalık Çalışma Planı</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400">{cls.name} · {formatWeekLabel(weekStart)}</p>
        </div>
        <nav className="flex gap-1" aria-label="Hafta gezinme">
          <Link href={nav(-1)} className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-200">← Önceki</Link>
          <Link href={`/siniflar/${classId}/plan`} className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-200">Bu hafta</Link>
          <Link href={nav(1)} className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-200">Sonraki →</Link>
        </nav>
      </div>

      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : students.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-slate-400">Bu sınıfta öğrenci yok.</p>
      ) : (
        <div className="space-y-2">
          {students.map(s => {
            const sum = weekSummary(s.items)
            return (
              <details key={s.id} className="group bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl" data-ogrenci-plan={s.id}>
                <summary className="cursor-pointer list-none px-4 py-3 flex items-center gap-3">
                  <span className="text-xs w-8 shrink-0 text-gray-500 dark:text-slate-400">{s.student_number ?? ''}</span>
                  <span className="flex-1 text-sm font-medium text-gray-900 dark:text-slate-100">{s.full_name}</span>
                  <span className="text-xs text-gray-500 dark:text-slate-400">{sum.toplam === 0 ? 'Plan yok' : `${sum.yapildi}/${sum.toplam} · %${sum.yuzde}`}</span>
                  <span className="w-24 h-1.5 rounded-full bg-gray-200 dark:bg-slate-700 overflow-hidden" aria-hidden>
                    <span className="block h-full bg-green-500" style={{ width: `${sum.yuzde}%` }} />
                  </span>
                </summary>
                <div className="px-4 pb-4 border-t border-gray-100 dark:border-slate-700 pt-3">
                  <HaftaEditoru
                    studentId={s.id} weekStart={weekStart}
                    items={s.items.map(i => ({ ...i, teacher_name: profile.full_name }))}
                    sources={sourcesByStudent.get(s.id) ?? []}
                    currentUserId={profile.id} canWrite
                  />
                </div>
              </details>
            )
          })}
        </div>
      )}
    </div>
  )
}
