import { redirect } from 'next/navigation'
import { createClient } from '@/src/infrastructure/supabase/server'
import { getCurrentProfile } from '@/src/shared/auth'
import { schoolYearStart } from '@/src/shared/utils'
import { countAbsences } from '@/src/domains/attendance/lib/attendanceMath'
import CizelgeClient from './CizelgeClient'

export default async function CizelgePage() {
  const [supabase, profile] = await Promise.all([createClient(), getCurrentProfile()])
  if (!profile?.school_id) redirect('/anasayfa')

  const isYonetici = ['mudur', 'mudur_yardimcisi'].includes(profile.role ?? '')

  const { data: rawClasses } = await supabase
    .from('classes')
    .select('id, name, grade, mentor_teacher_id, students(id, full_name, student_number, deleted_at)')
    .eq('school_id', profile.school_id)
    .is('deleted_at', null)
    .order('grade')
    .order('name')

  let classes = (rawClasses ?? []).map(cls => ({
    id: cls.id,
    name: cls.name,
    students: ((cls.students ?? []) as { id: string; full_name: string; student_number: string | null; deleted_at: string | null }[])
      .filter(s => !s.deleted_at)
      .map(({ deleted_at: _omit, ...s }) => s),
    mentor_teacher_id: cls.mentor_teacher_id,
  }))

  if (!isYonetici) {
    const { data: tcRows } = await supabase
      .from('teacher_classes')
      .select('class_id')
      .eq('teacher_id', profile.id)
    const allowed = new Set([
      ...classes.filter(c => c.mentor_teacher_id === profile.id).map(c => c.id),
      ...(tcRows ?? []).map(r => r.class_id),
    ])
    classes = classes.filter(c => allowed.has(c.id))
  }

  const allStudentIds = classes.flatMap(c => c.students.map(s => s.id))
  const { data: yearRows } = allStudentIds.length > 0
    ? await supabase
        .from('attendance')
        .select('student_id, status, date')
        .eq('school_id', profile.school_id)
        .in('student_id', allStudentIds)
        .gte('date', schoolYearStart())
        .in('status', ['absent', 'late', 'excused'])
        .limit(100000)
    : { data: [] as { student_id: string; status: string; date: string }[] }

  const yearCounts = countAbsences(yearRows ?? [])

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
