import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/src/shared/auth'
import { isTeachingRole } from '@/src/shared/types'
import { MentorService } from '@/src/domains/mentor/services/MentorService'
import { createClient } from '@/src/infrastructure/supabase/server'
import { format, parseISO } from '@/src/shared/date'
import { gunFarki } from '@/src/domains/mentor/mentorshipMath'
import OgrenciEkleKarti from './OgrenciEkleKarti'

export const metadata = { title: 'Mentörlük' }

export default async function MentorlukPage() {
  const profile = await getCurrentProfile()
  if (!profile?.school_id) redirect('/anasayfa')
  if (!isTeachingRole(profile.role)) redirect('/anasayfa')

  const [rows, supabase] = await Promise.all([MentorService.getMyMentorships(), createClient()])

  // Ekleme kutusu için okul öğrencileri (zaten listede olanlar çıkarılır)
  const { data: ogrenciler } = await supabase
    .from('students')
    .select('id, full_name, classes(name)')
    .eq('school_id', profile.school_id)
    .is('deleted_at', null)
    .order('full_name')
    .limit(500)

  const listedekiler = new Set(rows.map(r => r.student_id))
  const eklenebilir = (ogrenciler ?? [])
    .filter(o => !listedekiler.has(o.id))
    .map(o => ({
      id: o.id,
      full_name: o.full_name,
      class_name: (o.classes as { name: string } | null)?.name ?? null,
    }))

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between gap-3 mb-1">
        <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">Mentörlüğüm</h1>
        <span className="text-sm text-gray-500 dark:text-slate-400">{rows.length} öğrenci</span>
      </div>
      <p className="text-sm text-gray-500 dark:text-slate-400 mb-5">
        Mentörlük yaptığın öğrenciler. Notların yalnızca sana görünür.
      </p>

      <OgrenciEkleKarti ogrenciler={eklenebilir} />

      {rows.length === 0 ? (
        <div className="mt-6 text-center border border-dashed border-gray-200 dark:border-slate-700 rounded-2xl p-8">
          <p className="text-sm font-semibold text-gray-700 dark:text-slate-300">Henüz öğrenci eklemedin</p>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            Yukarıdan öğrenci ekleyerek tanıma kartını doldurmaya ve görüşme notu tutmaya başlayabilirsin.
          </p>
        </div>
      ) : (
        <ul className="mt-6 space-y-2">
          {rows.map(r => {
            const fark = r.last_report_date ? gunFarki(r.last_report_date) : null
            return (
              <li key={r.student_id}>
                <Link
                  href={`/mentorluk/${r.student_id}`}
                  className="flex items-center justify-between gap-3 p-4 rounded-2xl border border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-gray-200 dark:hover:border-slate-600 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 dark:text-slate-100 truncate">{r.full_name}</p>
                    <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{r.class_name ?? '—'}</p>
                  </div>
                  {r.last_report_date ? (
                    <span className={`shrink-0 text-xs font-medium px-2 py-1 rounded-full border ${
                      fark !== null && fark > 30
                        ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900'
                        : 'bg-gray-50 text-gray-600 border-gray-200 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-700'
                    }`}>
                      son görüşme {format(parseISO(r.last_report_date), 'd MMM')}
                    </span>
                  ) : (
                    <span className="shrink-0 text-xs font-medium px-2 py-1 rounded-full border bg-gray-50 text-gray-500 border-gray-200 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-700">
                      henüz görüşülmedi
                    </span>
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
