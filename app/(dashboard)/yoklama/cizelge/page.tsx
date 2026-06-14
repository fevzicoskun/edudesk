import { redirect } from 'next/navigation'
import { createClient } from '@/src/infrastructure/supabase/server'
import { getCurrentProfile } from '@/src/shared/auth'
import { schoolYearStart } from '@/src/shared/utils'
import { AttendanceRepository } from '@/src/domains/attendance/repositories/AttendanceRepository'
import CizelgeClient from './CizelgeClient'

export default async function CizelgePage() {
  const [supabase, profile] = await Promise.all([createClient(), getCurrentProfile()])
  if (!profile?.school_id) redirect('/anasayfa')

  const isYonetici = ['mudur', 'mudur_yardimcisi'].includes(profile.role ?? '')

  // classes ve teacher_classes birbirinden bağımsız — paralel çek (teacher_classes yalnızca profile.id'ye bağlı)
  const [{ data: rawClasses }, tcRes] = await Promise.all([
    supabase
      .from('classes')
      .select('id, name, grade, mentor_teacher_id, students(id, full_name, student_number, deleted_at)')
      .eq('school_id', profile.school_id)
      .is('deleted_at', null)
      .order('grade')
      .order('name'),
    isYonetici
      ? Promise.resolve(null)
      : supabase.from('teacher_classes').select('class_id').eq('teacher_id', profile.id),
  ])

  let classes = (rawClasses ?? []).map(cls => ({
    id: cls.id,
    name: cls.name,
    students: ((cls.students ?? []) as { id: string; full_name: string; student_number: string | null; deleted_at: string | null }[])
      .filter(s => !s.deleted_at)
      .map(({ deleted_at: _omit, ...s }) => s),
    mentor_teacher_id: cls.mentor_teacher_id,
  }))

  if (!isYonetici) {
    const allowed = new Set([
      ...classes.filter(c => c.mentor_teacher_id === profile.id).map(c => c.id),
      ...(tcRes?.data ?? []).map(r => r.class_id),
    ])
    classes = classes.filter(c => allowed.has(c.id))
  }

  const allStudentIds = classes.flatMap(c => c.students.map(s => s.id))
  const yearCounts = allStudentIds.length > 0
    ? await AttendanceRepository.getAbsenceCounts(supabase, profile.school_id, schoolYearStart())
    : {}

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">Yoklama Çizelgesi</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
          Aylık devamsızlık çizelgesi — D: Devamsız · G: Geç · Ö: Özürlü
        </p>
      </div>
      {classes.length === 0 ? (
        <p className="text-sm text-gray-400">
          Görüntüleyebileceğiniz sınıf yok. Sınıf öğretmeni atamanız veya ders programınız bulunmuyor.
        </p>
      ) : (
        <CizelgeClient classes={classes} yearCounts={yearCounts} />
      )}
    </div>
  )
}
