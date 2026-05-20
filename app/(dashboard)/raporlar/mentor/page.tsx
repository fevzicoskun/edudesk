import { redirect } from 'next/navigation'
import { createClient } from '@/src/infrastructure/supabase/server'
import { getCurrentProfile } from '@/src/shared/auth'
import { format, parseISO } from '@/src/shared/date'

const ALLOWED_ROLES = ['mudur', 'mudur_yardimcisi', 'zumre_baskani']

type RawReport = {
  id: string
  content: string
  report_date: string
  mentor_id: string
  students: { full_name: string; student_number: string | null } | null
  classes: { id: string; name: string } | null
  profiles: { id: string; full_name: string } | null
}

export default async function MentorRaporlarPage({
  searchParams,
}: {
  searchParams: Promise<{ class_id?: string }>
}) {
  const profile = await getCurrentProfile()
  if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
    redirect('/raporlar/ogrenci')
  }

  const { class_id } = await searchParams
  const supabase = await createClient()

  const sid = profile.school_id ?? ''

  let reportsQuery = supabase
    .from('mentor_reports')
    .select('id, content, report_date, mentor_id, students(full_name, student_number), classes(id, name), profiles(id, full_name)')
    .eq('school_id', sid)
    .order('report_date', { ascending: false })

  if (class_id) reportsQuery = reportsQuery.eq('class_id', class_id)

  const [reportsRes, classesRes] = await Promise.all([
    reportsQuery,
    supabase.from('classes').select('id, name').eq('school_id', sid).order('name'),
  ])
  const rawReports = (reportsRes.data ?? []) as unknown as RawReport[]
  const classes = classesRes.data ?? []

  return (
    <div>
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <form method="GET" className="flex items-center gap-2 flex-wrap">
          <select
            name="class_id"
            defaultValue={class_id ?? ''}
            className="text-sm border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px]"
          >
            <option value="">Tüm Sınıflar</option>
            {classes.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors min-h-[44px]"
          >
            Filtrele
          </button>
          {class_id && (
            <a
              href="/raporlar/mentor"
              className="px-3 py-2 text-sm text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 transition-colors min-h-[44px] flex items-center"
            >
              Temizle
            </a>
          )}
        </form>
        <span className="text-sm text-gray-400 dark:text-slate-500">
          {rawReports.length} rapor
        </span>
      </div>

      {rawReports.length === 0 ? (
        <div className="text-center py-20 text-gray-400 dark:text-slate-500 text-sm">
          {class_id ? 'Bu sınıfa ait mentör raporu bulunamadı.' : 'Henüz mentör raporu girilmemiş.'}
        </div>
      ) : (
        <div className="space-y-3">
          {rawReports.map(r => (
            <div
              key={r.id}
              className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4"
            >
              <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-gray-900 dark:text-slate-100 text-sm">
                    {r.students?.full_name ?? '—'}
                  </span>
                  {r.students?.student_number && (
                    <span className="text-xs text-gray-400 dark:text-slate-500">
                      No: {r.students.student_number}
                    </span>
                  )}
                  <span className="text-gray-300 dark:text-slate-600">·</span>
                  <span className="text-sm text-gray-500 dark:text-slate-400">{r.classes?.name ?? '—'}</span>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-medium text-gray-700 dark:text-slate-300">
                    {format(parseISO(r.report_date), 'd MMM yyyy')}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
                    {r.profiles?.full_name ?? '—'}
                  </p>
                </div>
              </div>
              <p className="text-sm text-gray-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                {r.content}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
