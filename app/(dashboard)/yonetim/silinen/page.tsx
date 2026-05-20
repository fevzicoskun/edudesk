import { redirect } from 'next/navigation'
import { createClient } from '@/src/infrastructure/supabase/server'
import { getCurrentProfile } from '@/src/shared/auth'
import { isYonetici } from '@/src/shared/types'
import SilinenListesi from './SilinenListesi'

export const revalidate = 0

export default async function SilinenPage() {
  const profile = await getCurrentProfile()
  if (!profile || !isYonetici(profile.role)) redirect('/anasayfa')

  const supabase = await createClient()
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const sid = profile.school_id

  const [classesResult, studentsResult, homeworksResult, meetingsResult, examsResult] =
    await Promise.all([
      supabase.from('classes').select('id, name, grade, deleted_at').eq('school_id', sid).not('deleted_at', 'is', null).gte('deleted_at', cutoff).order('deleted_at', { ascending: false }),
      supabase.from('students').select('id, full_name, class_id, deleted_at').eq('school_id', sid).not('deleted_at', 'is', null).gte('deleted_at', cutoff).order('deleted_at', { ascending: false }),
      supabase.from('homeworks').select('id, title, subject, deleted_at').eq('school_id', sid).not('deleted_at', 'is', null).gte('deleted_at', cutoff).order('deleted_at', { ascending: false }),
      supabase.from('zumre_meetings').select('id, title, meeting_date, deleted_at').eq('school_id', sid).not('deleted_at', 'is', null).gte('deleted_at', cutoff).order('deleted_at', { ascending: false }),
      supabase.from('common_exams').select('id, title, exam_date, deleted_at').eq('school_id', sid).not('deleted_at', 'is', null).gte('deleted_at', cutoff).order('deleted_at', { ascending: false }),
    ])

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">Silinen Kayıtlar</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">Son 30 gün içinde silinen kayıtlar</p>
      </div>
      <SilinenListesi
        classes={classesResult.data ?? []}
        students={studentsResult.data ?? []}
        homeworks={homeworksResult.data ?? []}
        meetings={meetingsResult.data ?? []}
        exams={examsResult.data ?? []}
      />
    </div>
  )
}
