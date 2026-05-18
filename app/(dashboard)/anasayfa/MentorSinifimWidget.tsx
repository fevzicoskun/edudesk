import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/src/shared/auth'
import Link from 'next/link'

type StudentRow = { id: string; full_name: string; student_number: string | null }
type ClassRow = { id: string; name: string; students: StudentRow[] }

export default async function MentorSinifimWidget() {
  const user = await getCurrentUser()
  if (!user) return null

  const supabase = await createClient()
  const { data } = await supabase
    .from('classes')
    .select('id, name, students(id, full_name, student_number)')
    .eq('mentor_teacher_id', user.id)
    .order('name')

  const mentorClasses = (data ?? []) as unknown as ClassRow[]
  if (mentorClasses.length === 0) return null

  return (
    <section className="mt-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-amber-800 dark:text-amber-300">
          Mentör Sınıfım
        </h2>
        <span className="text-xs text-amber-600 dark:text-amber-400">
          Öğrenci adına tıklayarak rapor ekle
        </span>
      </div>

      {mentorClasses.map(cls => (
        <div key={cls.id} className="mb-4 last:mb-0">
          <Link
            href={`/siniflar/${cls.id}`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300 hover:underline mb-2"
          >
            {cls.name}
            <span className="text-amber-500 dark:text-amber-500">({cls.students.length} öğrenci)</span>
          </Link>

          {cls.students.length === 0 ? (
            <p className="text-xs text-amber-600/70 dark:text-amber-400/70 pl-1">Bu sınıfta öğrenci yok.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {cls.students
                .sort((a, b) => a.full_name.localeCompare(b.full_name, 'tr'))
                .map(student => (
                  <Link
                    key={student.id}
                    href={`/siniflar/${cls.id}/ogrenciler/${student.id}`}
                    className="flex items-center justify-between px-3 py-2 bg-white dark:bg-slate-800 border border-amber-100 dark:border-amber-900/50 rounded-lg hover:border-amber-300 dark:hover:border-amber-700 hover:bg-amber-50/50 dark:hover:bg-amber-950/20 transition-colors group"
                  >
                    <div className="min-w-0">
                      <span className="text-sm text-gray-800 dark:text-slate-200 truncate block">
                        {student.full_name}
                      </span>
                      {student.student_number && (
                        <span className="text-xs text-gray-400 dark:text-slate-500">No: {student.student_number}</span>
                      )}
                    </div>
                    <span className="text-xs text-amber-500 dark:text-amber-400 font-medium shrink-0 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      Rapor →
                    </span>
                  </Link>
                ))}
            </div>
          )}
        </div>
      ))}
    </section>
  )
}
