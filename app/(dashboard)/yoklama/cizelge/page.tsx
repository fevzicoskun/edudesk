import { redirect } from 'next/navigation'
import { createClient } from '@/src/infrastructure/supabase/server'
import { getCurrentProfile } from '@/src/shared/auth'
import { schoolYearStart } from '@/src/shared/utils'
import EmptyState from '@/app/components/EmptyState'
import { AttendanceRepository } from '@/src/domains/attendance/repositories/AttendanceRepository'
import CizelgeClient from './CizelgeClient'

export const metadata = { title: 'Yoklama Çizelgesi' }

export default async function CizelgePage() {
  const [supabase, profile] = await Promise.all([createClient(), getCurrentProfile()])
  if (!profile?.school_id) redirect('/anasayfa')

  // Çizelge tüm okul sınıflarını gösterir (yoklama dropdown'ı ile tutarlı) — rol filtresi yok.
  const { data: rawClasses } = await supabase
    .from('classes')
    .select('id, name, grade, students(id, full_name, student_number, deleted_at)')
    .eq('school_id', profile.school_id)
    .is('deleted_at', null)
    .order('grade')
    .order('name')

  const classes = (rawClasses ?? []).map(cls => ({
    id: cls.id,
    name: cls.name,
    students: ((cls.students ?? []) as { id: string; full_name: string; student_number: string | null; deleted_at: string | null }[])
      .filter(s => !s.deleted_at)
      .map(({ deleted_at: _omit, ...s }) => s),
  }))

  const allStudentIds = classes.flatMap(c => c.students.map(s => s.id))
  // RPC hatasında (null) boş sayıma düş — çizelge yardımcı rozet, sayfa engellenmesin.
  const yearCounts = (allStudentIds.length > 0
    ? await AttendanceRepository.getAbsenceCounts(supabase, profile.school_id, schoolYearStart())
    : {}) ?? {}

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">Yoklama Çizelgesi</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
          Aylık devamsızlık çizelgesi — D: Devamsız · G: Geç · Ö: Özürlü
        </p>
      </div>
      {classes.length === 0 ? (
        <EmptyState
          title="Henüz sınıf yok"
          description="Çizelge için önce sınıf eklenmeli."
          action={['mudur', 'mudur_yardimcisi'].includes(profile.role)
            ? { label: 'Sınıf ekle', href: '/siniflar' }
            : undefined}
        />
      ) : (
        <CizelgeClient classes={classes} yearCounts={yearCounts} />
      )}
    </div>
  )
}
