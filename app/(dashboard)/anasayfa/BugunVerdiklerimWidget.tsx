import Link from 'next/link'
import { createClient } from '@/src/infrastructure/supabase/server'
import { istanbulLocalToUtc, todayLocalISO, format, parseISO } from '@/src/shared/date'
import { gunlukOdevMetni } from '@/src/domains/homework/lib/gunlukOdevMetni'
import KopyalaButonu from './KopyalaButonu'

/** Öğretmenin bugün (İstanbul günü) oluşturduğu ödevler — gün sonunda başka kanallara iletmek için. */
export default async function BugunVerdiklerimWidget({ teacherId, schoolId }: { teacherId: string; schoolId: string }) {
  const supabase = await createClient()
  // assigned_date DB'de CURRENT_DATE (UTC) — gece 00-03 arası kayar; created_at + İstanbul gün başı kullanılır
  const gunBasi = istanbulLocalToUtc(todayLocalISO(), '00:00').toISOString()
  const { data, error } = await supabase
    .from('homeworks')
    .select('id, title, subject, due_date, classes(name)')
    .eq('teacher_id', teacherId)
    .eq('school_id', schoolId)
    .eq('is_template', false)
    .is('deleted_at', null)
    .gte('created_at', gunBasi)
    .order('created_at')

  const odevler = (data ?? []).map(h => ({
    id: h.id,
    sinif: (Array.isArray(h.classes) ? h.classes[0]?.name : h.classes?.name) ?? '—',
    ders: h.subject,
    baslik: h.title,
    sonTeslim: h.due_date,
  }))

  return (
    <section className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300">
          Bugün Verdiğim Ödevler{odevler.length > 0 && <span className="text-gray-500 dark:text-slate-400 font-normal"> · {odevler.length}</span>}
        </h2>
        {odevler.length > 0 && <KopyalaButonu metin={gunlukOdevMetni(odevler)} />}
      </div>
      {error ? (
        <p className="px-4 py-6 text-sm text-red-600 dark:text-red-400">Ödevler yüklenemedi.</p>
      ) : odevler.length === 0 ? (
        <p className="px-4 py-6 text-sm text-gray-500 dark:text-slate-400">
          Bugün henüz ödev vermedin. <Link href="/odevler/yeni" className="text-blue-600 dark:text-blue-400 hover:underline">Ödev ver →</Link>
        </p>
      ) : (
        <ul className="divide-y divide-gray-100 dark:divide-slate-700/60">
          {odevler.map(o => (
            <li key={o.id}>
              <Link href={`/odevler/${o.id}`} className="block px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">{o.baslik}</p>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                  {o.sinif} · {o.ders}{o.sonTeslim && ` · son teslim ${format(parseISO(o.sonTeslim), 'd MMM')}`}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
