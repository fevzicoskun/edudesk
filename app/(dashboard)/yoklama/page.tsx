export const revalidate = 30

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/src/infrastructure/supabase/server'
import { getCurrentProfile } from '@/src/shared/auth'
import { getEgitimYili, schoolYearStart } from '@/src/shared/utils'
import { type AttendanceStatus } from '@/app/actions/yoklama'
import { AttendanceRepository } from '@/src/domains/attendance/repositories/AttendanceRepository'
import type { AbsenceCount } from '@/src/domains/attendance/types'
import YoklamaClient from './YoklamaClient'

export const metadata = { title: 'Yoklama' }

export default async function YoklamaPage({ searchParams }: { searchParams: Promise<{ sinif?: string }> }) {
  const { sinif } = await searchParams
  const [supabase, profile] = await Promise.all([createClient(), getCurrentProfile()])
  if (!profile?.school_id) redirect('/anasayfa')

  // classes ve teacher_classes birbirinden bağımsız — paralel çek (teacher_classes yalnızca profile.id'ye bağlı)
  const [{ data: rawClasses }, { data: tcRows }] = await Promise.all([
    supabase
      .from('classes')
      .select('id, name, grade, students(id, full_name, student_number, deleted_at)')
      .eq('school_id', profile.school_id)
      .is('deleted_at', null)
      .order('grade')
      .order('name'),
    supabase
      .from('teacher_classes')
      .select('class_id')
      .eq('teacher_id', profile.id),
  ])

  const classes: ClassWithStudents[] = (rawClasses ?? []).map(cls => ({
    id: cls.id,
    name: cls.name,
    grade: cls.grade,
    students: ((cls.students ?? []) as (Student & { deleted_at: string | null })[])
      .filter(s => !s.deleted_at)
      .map(({ deleted_at: _omit, ...s }) => s),
  }))

  // "Sınıflarım" = ders verdiğim sınıflar (teacher_classes). Rehberlik (mentor_teacher_id)
  // yoklama grubunu belirlemez — yoklamayı ders saatinde branş öğretmeni alır.
  const myClassIds = new Set<string>((tcRows ?? []).map(r => r.class_id))

  const canEditAfterLock = ['mudur_yardimcisi', 'mudur', 'admin'].includes(profile.role)

  const validSinif   = sinif && classes.some(c => c.id === sinif) ? sinif : null
  const firstMyClass = classes.find(c => myClassIds.has(c.id))?.id ?? null
  const firstClassId = validSinif ?? firstMyClass ?? classes[0]?.id ?? ''

  const studentIds = classes.flatMap(c => c.students.map(s => s.id))
  const todayISO   = new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Istanbul' }).format(new Date())

  const [absenceCountsRes, todayRes, takenTodayRes] = await Promise.all([
    studentIds.length > 0
      ? AttendanceRepository.getAbsenceCounts(supabase, profile.school_id, schoolYearStart())
      : Promise.resolve({} as Record<string, AbsenceCount>),
    firstClassId
      ? supabase
          .from('attendance')
          .select('student_id, status')
          .eq('class_id', firstClassId)
          .eq('school_id', profile.school_id)
          .eq('date', todayISO)
      : Promise.resolve({ data: [] as { student_id: string; status: string }[] }),
    classes.length > 0
      ? supabase
          .from('attendance')
          .select('class_id')
          .eq('school_id', profile.school_id)
          .eq('date', todayISO)
          .in('class_id', classes.map(c => c.id))
      : Promise.resolve({ data: [] as { class_id: string }[] }),
  ])

  // Yardımcı rozet verisi: RPC hatasında (null) boş sayıma düş — yoklama girişi engellenmesin.
  const absenceCounts = absenceCountsRes ?? {}

  const takenTodayIds = [...new Set((takenTodayRes.data ?? []).map(r => r.class_id))]

  const initialStatuses: Record<string, AttendanceStatus> = {}
  for (const row of todayRes.data ?? []) {
    initialStatuses[row.student_id] = row.status as AttendanceStatus
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">Yoklama</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">{getEgitimYili()} — Devamsız ve geç öğrencilerin velisine otomatik e-posta gider (özürlüye gitmez)</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link
            href="/yoklama/analitik"
            className="text-sm text-blue-600 dark:text-blue-400 font-medium hover:underline shrink-0"
          >
            Analitik →
          </Link>
          <Link
            href="/yoklama/cizelge"
            className="shrink-0 text-xs font-medium text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900 px-3 py-2 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
          >
            Çizelge →
          </Link>
        </div>
      </div>
      <YoklamaClient
        classes={classes}
        absenceCounts={absenceCounts}
        initialStatuses={initialStatuses}
        initialDate={todayISO}
        myClassIds={[...myClassIds]}
        initialClassId={firstClassId}
        canEditAfterLock={canEditAfterLock}
        takenTodayIds={takenTodayIds}
      />
    </div>
  )
}

interface Student          { id: string; full_name: string; student_number: string | null }
export interface ClassWithStudents {
  id: string
  name: string
  grade: number
  students: Student[]
}
