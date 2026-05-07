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
    .select('*, classes(id, name, grade)')
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

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-bold text-gray-900">Ödevler</h1>
        <Link
          href="/odevler/yeni"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          + Yeni Ödev
        </Link>
      </div>

      <OdevlerFilterBar
        classes={classes}
        subjects={subjects}
        teachers={isZumreBaskani ? teachers : []}
        currentParams={params}
      />

      {homeworks.length === 0 ? (
        <div className="text-center py-20 text-gray-400 text-sm">Henüz ödev eklenmemiş.</div>
      ) : (
        <div className="space-y-3">
          {homeworks.map((hw) => {
            const overdue = isPast(parseISO(hw.due_date + 'T23:59:59'))
            const cls = hw.classes as { name: string } | null
            return (
              <div
                key={hw.id}
                className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link
                      href={`/odevler/${hw.id}`}
                      className="font-medium text-gray-900 hover:text-blue-600 transition-colors"
                    >
                      {hw.title}
                    </Link>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${
                        overdue ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                      }`}
                    >
                      {overdue ? 'Geçmiş' : 'Aktif'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {cls?.name ?? '—'} · {hw.subject} · Son:{' '}
                    {(() => {
                      try {
                        return hw.due_date
                          ? format(parseISO(hw.due_date), 'd MMM yyyy', { locale: tr })
                          : 'Tarih yok'
                      } catch {
                        return 'Tarih yok'
                      }
                    })()}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <Link
                    href={`/odevler/${hw.id}`}
                    className="text-xs text-blue-600 font-medium hover:underline"
                  >
                    Durumlar
                  </Link>
                  <ConfirmDeleteButton
                    action={deleteHomework.bind(null, hw.id)}
                    message={`"${hw.title}" ödevini ve tüm durum kayıtlarını silmek istediğine emin misin?`}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
