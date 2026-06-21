import { createClient } from '@/src/infrastructure/supabase/server'
import { getCurrentProfile } from '@/src/shared/auth'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { addStudent } from '@/src/domains/classes/actions'
import { getEgitimYili, schoolYearStart } from '@/src/shared/utils'
import { ATTENDANCE_WARN_DAYS, ATTENDANCE_LIMIT_DAYS } from '@/src/shared/constants/attendance'
import BulkStudentModal from './BulkStudentModal'
import BulkVeliLinkModal from './BulkVeliLinkModal'
import { VeliAnalyticsRepository } from '@/src/domains/classes/repositories/VeliAnalyticsRepository'
import SinifExportButton from './SinifExportButton'
import OgrenciListesi from './OgrenciListesi'
import { Suspense } from 'react'
import PerformansWidget from './PerformansWidget'
import MentorAtamaKarti from './MentorAtamaKarti'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const profile = await getCurrentProfile()
  if (!profile?.school_id) return { title: 'Sınıf' }
  const supabase = await createClient()
  const { data } = await supabase
    .from('classes')
    .select('name')
    .eq('id', id)
    .eq('school_id', profile.school_id)
    .is('deleted_at', null)
    .single()
  return { title: data?.name ?? 'Sınıf' }
}

export default async function SinifDetayPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [supabase, profile] = await Promise.all([createClient(), getCurrentProfile()])

  const schoolId = profile?.school_id ?? ''

  const yearStart = schoolYearStart()

  const [clsResult, studentsResult, absenceResult, viewCounts, teachersResult] = await Promise.all([
    supabase
      .from('classes')
      .select('name, mentor_teacher_id')
      .eq('id', id)
      .eq('school_id', schoolId)
      .is('deleted_at', null)
      .single(),
    supabase
      .from('students')
      .select('id, full_name, student_number, veli_email, veli_telefon, veli_ad')
      .eq('class_id', id)
      .eq('school_id', schoolId)
      .is('deleted_at', null)
      .order('student_number', { nullsFirst: false })
      .order('full_name'),
    supabase
      .from('attendance')
      .select('student_id, status')
      .eq('class_id', id)
      .eq('school_id', schoolId)
      .in('status', ['absent', 'late'])
      .gte('date', yearStart),
    VeliAnalyticsRepository.getVeliViewCounts(id, schoolId),
    supabase
      .from('profiles')
      .select('id, full_name')
      .eq('school_id', schoolId)
      .in('role', ['ogretmen', 'zumre_baskani', 'mudur_yardimcisi', 'mudur'])
      .order('full_name'),
  ])

  if (!clsResult.data) notFound()

  const cls      = clsResult.data
  const egitimYili = getEgitimYili()

  // Sayısal sıralama: text alanda '9' > '100' olur, JS'de parseInt ile düzeltiyoruz
  const students = (studentsResult.data ?? []).sort((a, b) => {
    const na = parseInt(a.student_number ?? '', 10)
    const nb = parseInt(b.student_number ?? '', 10)
    if (!isNaN(na) && !isNaN(nb)) return na - nb
    if (!isNaN(na)) return -1
    if (!isNaN(nb)) return 1
    return a.full_name.localeCompare(b.full_name, 'tr')
  })

  const absenceCounts: Record<string, number> = {}
  for (const a of absenceResult.data ?? []) {
    const inc = a.status === 'absent' ? 1 : 0.5
    absenceCounts[a.student_id] = (absenceCounts[a.student_id] ?? 0) + inc
  }

  const canManage = profile?.role === 'mudur' || profile?.role === 'mudur_yardimcisi'

  // Rehber öğretmen dropdown'ı için okul personeli (ad'ı olanlar)
  const teachers = (teachersResult.data ?? [])
    .filter((t): t is { id: string; full_name: string } => !!t.full_name)

  const maxNumber = students.reduce((max, s) => {
    const n = parseInt(s.student_number ?? '', 10)
    return isNaN(n) ? max : Math.max(max, n)
  }, 0)

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <Link href="/siniflar" className="text-sm text-gray-500 hover:text-gray-700 mb-3 inline-block">
        ← Sınıflar
      </Link>

      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">{cls.name}</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400">{students.length} öğrenci · {egitimYili}</p>
        </div>
        <SinifExportButton classId={id} className={cls.name} />
      </div>

      {canManage && (
        <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-5 mb-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300">Öğrenci Ekle</h2>
            <div className="flex gap-2">
              <BulkVeliLinkModal classId={id} />
              <BulkStudentModal classId={id} maxNumber={maxNumber} />
            </div>
          </div>
          <form action={addStudent.bind(null, id)} className="flex gap-2 flex-wrap">
            <input
              name="full_name"
              type="text"
              required
              placeholder="Ad Soyad"
              className="flex-1 min-w-0 px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-base bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              name="student_number"
              type="text"
              placeholder="Numara"
              className="px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-base w-full sm:w-24 bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              Ekle
            </button>
          </form>
        </div>
      )}

      {canManage && (
        <MentorAtamaKarti
          classId={id}
          teachers={teachers}
          currentMentorId={cls.mentor_teacher_id ?? null}
        />
      )}

      <Suspense fallback={null}>
        <PerformansWidget classId={id} />
      </Suspense>

      {students.length === 0 ? (
        <div className="text-center py-20 text-gray-400 text-sm">Bu sınıfta henüz öğrenci yok.</div>
      ) : (
        <OgrenciListesi
          students={students}
          classId={id}
          canDelete={canManage}
          absenceCounts={absenceCounts}
          warnDays={ATTENDANCE_WARN_DAYS}
          limitDays={ATTENDANCE_LIMIT_DAYS}
          viewCounts={viewCounts}
        />
      )}
    </div>
  )
}
