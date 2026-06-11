import { createClient } from '@/src/infrastructure/supabase/server'
import { getCurrentProfile, getCurrentUser } from '@/src/shared/auth'
import { redirect } from 'next/navigation'
import { isMudurOrAbove } from '@/src/shared/types'
import Link from 'next/link'
import HomeworkCalendar from './HomeworkCalendar'

export const revalidate = 60

export default async function OdevTakvimPage() {
  const [user, profile] = await Promise.all([getCurrentUser(), getCurrentProfile()])
  if (!user || !profile?.school_id) redirect('/login')

  const supabase   = await createClient()
  const sid        = profile.school_id
  const isManager  = profile.role === 'zumre_baskani' || isMudurOrAbove(profile.role)

  let query = supabase
    .from('homeworks')
    .select('id, title, subject, due_date, classes(name)')
    .eq('school_id', sid)
    .is('deleted_at', null)
    .eq('is_template', false)
    .not('due_date', 'is', null)
    .order('due_date')

  if (!isManager) {
    query = query.eq('teacher_id', user.id)
  }

  const { data: rawHomeworks } = await query
  const homeworks = (rawHomeworks ?? []).map(hw => ({
    ...hw,
    classes: Array.isArray(hw.classes) ? (hw.classes[0] ?? null) : hw.classes,
  }))

  const hwIds = homeworks.map(h => h.id)

  const { data: subRows } = hwIds.length > 0
    ? await supabase
        .from('homework_submissions')
        .select('homework_id, status')
        .in('homework_id', hwIds)
        .eq('school_id', sid)
    : { data: [] as { homework_id: string; status: string }[] }

  const completionMap: Record<string, { yapildi: number; total: number }> = {}
  for (const row of subRows ?? []) {
    const cur = completionMap[row.homework_id] ?? { yapildi: 0, total: 0 }
    cur.total++
    if (row.status === 'yapildi') cur.yapildi++
    completionMap[row.homework_id] = cur
  }

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-50 via-blue-50/10 to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="p-4 md:p-6 max-w-6xl mx-auto">

        {/* Başlık */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link
              href="/odevler"
              className="flex items-center justify-center w-9 h-9 rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-500 hover:text-gray-800 shadow-sm transition-all"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div>
              <h1 className="text-lg font-bold text-gray-900 dark:text-slate-100">Ödev Takvimi</h1>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                {homeworks?.length ?? 0} ödev · Gün seçerek detay görün veya ödev ekle
              </p>
            </div>
          </div>
          <Link
            href="/odevler/yeni"
            className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-md shadow-blue-500/25 transition-all"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            <span className="hidden sm:inline">Yeni Ödev</span>
          </Link>
        </div>

        <HomeworkCalendar homeworks={homeworks ?? []} completionMap={completionMap} />

      </div>
    </div>
  )
}
