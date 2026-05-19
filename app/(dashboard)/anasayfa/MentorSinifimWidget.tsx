import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/src/shared/auth'
import Link from 'next/link'

export default async function MentorSinifimWidget() {
  const user = await getCurrentUser()
  if (!user) return null

  const supabase = await createClient()
  const { data } = await supabase
    .from('classes')
    .select('id, name, students(id)')
    .eq('mentor_teacher_id', user.id)

  const classes = (data ?? []) as { id: string; name: string; students: { id: string }[] }[]
  if (classes.length === 0) return null

  const totalStudents = classes.reduce((s, c) => s + c.students.length, 0)

  return (
    <div className="mt-4">
      <Link
        href="/mentorluk"
        className="flex items-center justify-between px-4 py-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-xl hover:bg-amber-100 dark:hover:bg-amber-950/50 transition-colors group"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Mentor Sınıfım</p>
            <p className="text-xs text-amber-600 dark:text-amber-400">
              {classes.map(c => c.name).join(', ')} · {totalStudents} öğrenci
            </p>
          </div>
        </div>
        <span className="text-xs text-amber-500 dark:text-amber-400 font-medium group-hover:translate-x-0.5 transition-transform">
          Mentörlük →
        </span>
      </Link>
    </div>
  )
}
