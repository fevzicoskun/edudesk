import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/src/shared/auth'
import { isTeachingRole } from '@/src/shared/types'
import { MentorService } from '@/src/domains/mentor/services/MentorService'
import { HomeworkService } from '@/src/domains/homework/services/HomeworkService'
import { createClient } from '@/src/infrastructure/supabase/server'
import { todayLocalISO } from '@/src/shared/date'
import { donemBasi } from '@/src/shared/utils'
import { basTarihi, mentorTablosu } from '@/src/domains/mentor/lib/mentorTablosu'
import OgrenciEkleKarti from './OgrenciEkleKarti'
import MentorTablosu from './MentorTablosu'

export const metadata = { title: 'Mentörlük' }

const ikincilButon = 'px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700'

export default async function MentorlukPage({ searchParams }: { searchParams: Promise<{ bas?: string | string[] }> }) {
  const profile = await getCurrentProfile()
  if (!profile?.school_id) redirect('/anasayfa')
  if (!isTeachingRole(profile.role)) redirect('/anasayfa')

  const bugun = todayLocalISO()
  const bas = basTarihi((await searchParams).bas, donemBasi(), bugun)
  const [rows, adlar, eskiler, supabase] = await Promise.all([
    MentorService.getMyMentorships(), MentorService.getMentorAdlari(), MentorService.getEskiOgrencilerim(), createClient(),
  ])

  // Ekleme kutusu için okul öğrencileri (zaten listede olanlar çıkarılır)
  const [{ data: ogrenciler }, sonuc] = await Promise.all([
    supabase
      .from('students')
      .select('id, full_name, classes(name)')
      .eq('school_id', profile.school_id)
      .is('deleted_at', null)
      .order('full_name')
      .limit(1000),
    HomeworkService.getMentorHomeworkProfiles(rows.map(r => r.student_id), bas),
  ])
  if ('error' in sonuc) throw new Error(sonuc.error)

  const listedekiler = new Set(rows.map(r => r.student_id))
  const eklenebilir = (ogrenciler ?? [])
    .filter(o => !listedekiler.has(o.id))
    .map(o => ({
      id: o.id,
      full_name: o.full_name,
      class_name: (o.classes as { name: string } | null)?.name ?? null,
      mentor: adlar.get(o.id)?.ad ?? null,
    }))

  const tablo = mentorTablosu(sonuc.ogrenciler.map(o => ({
    id: o.id, full_name: o.full_name, class_name: o.class_name, homeworks: o.homeworks,
  })))
  const sonGorusme = Object.fromEntries(rows.map(r => [r.student_id, r.last_report_date]))

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between gap-3 mb-1">
        <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">Mentörlüğüm</h1>
        <span className="text-sm text-gray-500 dark:text-slate-400">{rows.length} öğrenci</span>
      </div>
      <p className="text-sm text-gray-500 dark:text-slate-400 mb-5">
        Mentörlük yaptığın öğrenciler ve tüm derslerdeki ödev durumları. Notların yalnızca sana görünür.
      </p>

      {rows.length > 0 && (
        <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
          <form method="get" className="flex items-end gap-2">
            <label className="text-sm text-gray-600 dark:text-slate-400">
              Şu tarihten itibaren
              <input
                type="date" name="bas" defaultValue={bas} max={bugun}
                className="block mt-1 px-2 py-1.5 border border-gray-300 dark:border-slate-600 rounded-lg text-base bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100"
              />
            </label>
            <button className={ikincilButon}>Uygula</button>
          </form>
          <div className="flex gap-2">
            <Link href={`/mentorluk/tablo?bas=${bas}`} className={ikincilButon}>Tabloyu yazdır</Link>
            <Link href={`/mentorluk/yazdir?bas=${bas}`} className={ikincilButon}>Hepsini yazdır</Link>
            <Link href="/mentorluk/bulten" className={ikincilButon}>Haftalık veli bülteni</Link>
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="mb-6 text-center border border-dashed border-gray-200 dark:border-slate-700 rounded-2xl p-8">
          <p className="text-sm font-semibold text-gray-700 dark:text-slate-300">Henüz öğrenci eklemedin</p>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            Aşağıdan öğrenci ekleyerek tanıma kartını doldurmaya ve görüşme notu tutmaya başlayabilirsin.
          </p>
        </div>
      ) : (
        <div className="mb-6">
          <MentorTablosu tablo={tablo} sonGorusme={sonGorusme} bas={bas} />
        </div>
      )}

      <div className="max-w-3xl">
        <OgrenciEkleKarti ogrenciler={eklenebilir} />
      </div>

      {eskiler.length > 0 && (
        <section className="max-w-3xl mt-8">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300">Önceki öğrencilerim</h2>
          <p className="text-xs text-gray-500 dark:text-slate-400 mb-2">Mentörlüğü başka öğretmene geçti — notlarını salt okunur görebilirsin.</p>
          <ul className="flex flex-wrap gap-2">
            {eskiler.map(e => (
              <li key={e.student_id}>
                <Link href={`/mentorluk/${e.student_id}`} className="inline-flex items-center min-h-[44px] px-3 rounded-xl border border-gray-200 dark:border-slate-700 text-sm text-gray-700 dark:text-slate-300 hover:border-gray-300 dark:hover:border-slate-500">
                  {e.full_name}<span className="ml-1 text-xs text-gray-500 dark:text-slate-400">· {e.class_name ?? '—'}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
