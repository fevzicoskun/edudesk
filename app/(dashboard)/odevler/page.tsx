import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { deleteHomework } from '@/app/actions/homework'
import { format, isPast, parseISO } from 'date-fns'
import { tr } from 'date-fns/locale'
import { ConfirmDeleteButton } from '@/components/ConfirmDeleteButton'
import OdevlerFilterBar from './FilterBar'

export default async function OdevlerPage({
  searchParams,
}: {
  searchParams: Promise<{
    sinif?: string
    baslangic?: string
    bitis?: string
    ders?: string
    durum?: string
    ogretmen?: string
  }>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const isZumreBaskani = profile?.role === 'zumre_baskani'

  let query = supabase
    .from('homeworks')
    .select('*, classes(id, name, grade), teacher:profiles(full_name)')
    .order('due_date', { ascending: false })

  if (!isZumreBaskani) {
    query = query.eq('teacher_id', user.id)
  } else if (params.ogretmen) {
    query = query.eq('teacher_id', params.ogretmen)
  }

  if (params.sinif) query = query.eq('class_id', params.sinif)
  if (params.baslangic) query = query.gte('due_date', params.baslangic)
  if (params.bitis) query = query.lte('due_date', params.bitis)
  if (params.ders) query = query.eq('subject', params.ders)

  let durumIds: string[] | null = null
  if (params.durum) {
    const { data: subs } = await supabase
      .from('homework_submissions')
      .select('homework_id')
      .eq('status', params.durum)
    durumIds = [...new Set((subs ?? []).map((s) => s.homework_id))]
  }

  if (durumIds !== null) {
    query = query.in('id', durumIds.length > 0 ? durumIds : ['00000000-0000-0000-0000-000000000000'])
  }

  const homeworksResult = await query

  const subjectsQuery = isZumreBaskani
    ? supabase.from('homeworks').select('subject')
    : supabase.from('homeworks').select('subject').eq('teacher_id', user.id)

  const [classesResult, subjectsResult, teachersResult] = await Promise.all([
    supabase.from('classes').select('id, name, grade').order('grade').order('name'),
    subjectsQuery,
    isZumreBaskani
      ? supabase.from('profiles').select('id, full_name').order('full_name')
      : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
  ])

  const homeworks = homeworksResult.data ?? []
  const classes = classesResult.data ?? []
  const subjects = [...new Set((subjectsResult.data ?? []).map((h) => h.subject).filter(Boolean))] as string[]
  const teachers = (teachersResult.data ?? []) as { id: string; full_name: string }[]

  const activeCount = homeworks.filter((hw) => !isPast(parseISO(hw.due_date + 'T23:59:59'))).length
  const overdueCount = homeworks.length - activeCount

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-50 via-red-50/10 to-slate-50">
      <div className="p-4 md:p-6 max-w-4xl mx-auto">

        {/* Page header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Ödevler</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              {homeworks.length} ödev · {activeCount} aktif
            </p>
          </div>
          <Link
            href="/odevler/yeni"
            className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-md shadow-blue-500/25 hover:shadow-blue-500/35 transition-all duration-200"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Yeni Ödev
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: 'Toplam', value: homeworks.length, color: 'text-gray-900' },
            { label: 'Aktif', value: activeCount, color: 'text-emerald-600' },
            { label: 'Geçmiş', value: overdueCount, color: 'text-red-500' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white rounded-xl border border-gray-100 px-4 py-3.5 shadow-sm">
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        <OdevlerFilterBar
          classes={classes}
          subjects={subjects}
          teachers={isZumreBaskani ? teachers : []}
          currentParams={params}
        />

        {/* Homework list */}
        {homeworks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <p className="text-gray-900 font-semibold text-base">Henüz ödev yok</p>
            <p className="text-gray-400 text-sm mt-1 max-w-xs">
              Sınıflarınıza ödev tanımlamak için yeni bir ödev oluşturun.
            </p>
            <Link
              href="/odevler/yeni"
              className="mt-5 flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold shadow-md shadow-blue-500/25 hover:shadow-blue-500/35 transition-all duration-200"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              İlk Ödevi Oluştur
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {homeworks.map((hw) => {
              const overdue = isPast(parseISO(hw.due_date + 'T23:59:59'))
              const cls = hw.classes as { name: string } | null
              const teacher = (hw as typeof hw & { teacher?: { full_name: string } | null }).teacher

              let dueDateStr = 'Tarih yok'
              try {
                if (hw.due_date) dueDateStr = format(parseISO(hw.due_date), 'd MMM yyyy', { locale: tr })
              } catch { /* keep default */ }

              return (
                <div
                  key={hw.id}
                  className="group bg-white rounded-2xl border border-gray-100 hover:border-gray-200 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden"
                >
                  {/* Status bar */}
                  <div className={`h-0.5 ${overdue ? 'bg-red-400' : 'bg-emerald-400'}`} />

                  <div className="p-5">
                    {/* Top: title + badge */}
                    <div className="flex items-start justify-between gap-3 mb-2.5">
                      <Link
                        href={`/odevler/${hw.id}`}
                        className="font-semibold text-gray-900 hover:text-red-700 transition-colors leading-snug text-base"
                      >
                        {hw.title}
                      </Link>
                      <span
                        className={`shrink-0 inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full border ${
                          overdue
                            ? 'bg-red-50 text-red-600 border-red-100'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${overdue ? 'bg-red-500' : 'bg-emerald-500'}`} />
                        {overdue ? 'Geçmiş' : 'Aktif'}
                      </span>
                    </div>

                    {/* Class + subject chips */}
                    <div className="flex items-center gap-2 mb-3">
                      <span className="inline-flex items-center text-xs font-medium text-gray-600 bg-gray-100 px-2 py-0.5 rounded-md">
                        {cls?.name ?? '—'}
                      </span>
                      <span className="text-gray-300">·</span>
                      <span className="text-xs text-gray-500">{hw.subject}</span>
                    </div>

                    {/* Description preview */}
                    {hw.description && (
                      <p className="text-sm text-gray-500 line-clamp-2 mb-4 leading-relaxed">
                        {hw.description}
                      </p>
                    )}

                    {/* Bottom: meta + actions */}
                    <div className="flex items-center justify-between pt-3 border-t border-gray-50">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5 text-xs text-gray-400">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <span>{dueDateStr}</span>
                        </div>
                        {teacher?.full_name && (
                          <div className="hidden sm:flex items-center gap-1.5 text-xs text-gray-400">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            <span>{teacher.full_name}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-3">
                        <Link
                          href={`/odevler/${hw.id}`}
                          className="flex items-center gap-1 text-xs font-semibold text-red-700 hover:text-red-800 transition-colors"
                        >
                          Detay
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                          </svg>
                        </Link>
                        <ConfirmDeleteButton
                          action={deleteHomework.bind(null, hw.id)}
                          message={`"${hw.title}" ödevini silmek istediğine emin misin?`}
                          className="text-xs text-gray-400 hover:text-red-500 font-medium transition-colors disabled:opacity-50"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
