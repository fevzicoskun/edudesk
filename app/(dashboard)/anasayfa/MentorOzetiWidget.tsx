import { createClient } from '@/src/infrastructure/supabase/server'
import { requireSchoolId } from '@/src/shared/auth'
import Link from 'next/link'
import { subDays } from '@/src/shared/date'

export default async function MentorOzetiWidget() {
  const supabase = await createClient()
  const school_id = await requireSchoolId()

  const thirtyDaysAgo = subDays(new Date(), 30).toISOString().split('T')[0]

  const [reportsRes, profilesRes] = await Promise.all([
    supabase.from('mentor_reports').select('mentor_id').eq('school_id', school_id).gte('report_date', thirtyDaysAgo),
    supabase.from('profiles').select('id, full_name, subject').eq('school_id', school_id),
  ])

  const profiles = profilesRes.data ?? []
  const counts = new Map<string, number>()
  for (const r of reportsRes.data ?? []) {
    counts.set(r.mentor_id, (counts.get(r.mentor_id) ?? 0) + 1)
  }

  const entries = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([mentorId, count]) => {
      const t = profiles.find(p => p.id === mentorId)
      return { mentorId, count, name: t?.full_name, subject: t?.subject ?? undefined }
    })

  if (entries.length === 0) return null

  return (
    <section className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300">Mentör Rapor Özeti (Son 30 Gün)</h2>
        <Link href="/raporlar/mentor" className="text-xs text-purple-600 font-medium hover:underline">Tümü →</Link>
      </div>
      <ul className="divide-y divide-gray-100 dark:divide-slate-700">
        {entries.map(e => (
          <li key={e.mentorId} className="flex items-center justify-between px-4 py-2.5">
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">
                {e.name ?? 'Bilinmeyen Öğretmen'}
              </p>
              {e.subject && <p className="text-xs text-gray-400 dark:text-slate-500">{e.subject}</p>}
            </div>
            <span className="text-xs font-semibold px-2 py-1 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 shrink-0">
              {e.count} rapor
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
