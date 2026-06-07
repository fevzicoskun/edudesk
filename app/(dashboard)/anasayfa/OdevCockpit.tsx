import Link from 'next/link'
import { createClient } from '@/src/infrastructure/supabase/server'
import { getCurrentUser } from '@/src/shared/auth'

export default async function OdevCockpit({ schoolId }: { schoolId: string }) {
  const user = await getCurrentUser()
  if (!user) return null

  const supabase = await createClient()
  const today = new Date().toISOString().split('T')[0]

  const overdueRes = await supabase
    .from('homeworks')
    .select('id, title, due_date, class_id, classes(name), homework_submissions(homework_id)')
    .eq('teacher_id', user.id)
    .eq('school_id', schoolId)
    .eq('is_template', false)
    .is('deleted_at', null)
    .lt('due_date', today)
    .order('due_date', { ascending: false })
    .limit(20)

  const allOverdue = overdueRes.data ?? []
  const unreviewed = allOverdue.filter(hw => {
    const subs = (hw.homework_submissions as unknown as { homework_id: string }[] | null) ?? []
    return subs.length === 0
  })

  if (unreviewed.length === 0) return null

  return (
    <div className="mb-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-2xl overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-red-200 dark:border-red-800/60">
        <div className="w-7 h-7 bg-red-100 dark:bg-red-900/40 rounded-lg flex items-center justify-center shrink-0">
          <svg className="w-4 h-4 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-red-800 dark:text-red-300">
            {unreviewed.length} ödev giriş bekliyor
          </p>
          <p className="text-xs text-red-600/80 dark:text-red-400/70 mt-0.5">
            Son tarihi geçti, henüz hiç işaretleme yapılmadı.
          </p>
        </div>
      </div>
      <div className="divide-y divide-red-100 dark:divide-red-900/40">
        {unreviewed.slice(0, 5).map(hw => {
          const cls = (Array.isArray(hw.classes) ? hw.classes[0] : hw.classes) as { name: string } | null
          const daysAgo = Math.floor((new Date().getTime() - new Date(hw.due_date).getTime()) / 86_400_000)
          return (
            <Link
              key={hw.id}
              href={`/odevler/${hw.id}`}
              className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-red-100/50 dark:hover:bg-red-900/20 transition-colors group"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate group-hover:text-red-700 dark:group-hover:text-red-300 transition-colors">
                  {hw.title}
                </p>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                  {cls?.name ?? '—'}
                </p>
              </div>
              <span className="shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
                {daysAgo === 0 ? 'bugün bitti' : `${daysAgo}g önce`}
              </span>
            </Link>
          )
        })}
        {unreviewed.length > 5 && (
          <Link
            href="/odevler"
            className="block px-4 py-2.5 text-center text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-100/50 dark:hover:bg-red-900/20 transition-colors"
          >
            +{unreviewed.length - 5} ödev daha → Tümünü gör
          </Link>
        )}
      </div>
    </div>
  )
}
