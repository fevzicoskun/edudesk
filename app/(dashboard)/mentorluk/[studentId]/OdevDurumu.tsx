import { dersOzeti, dersOzetiMetni, type HomeworkRecord } from '@/src/domains/homework/lib/stats'
import { format, parseISO } from '@/src/shared/date'

/** Mentör detayında ödev özeti: ders satırı + yapılmayan/eksik liste (seçilen aralık). */
export default function OdevDurumu({ homeworks }: { homeworks: HomeworkRecord[] }) {
  const dersler = dersOzeti(homeworks)
  const sorunlu = homeworks.filter(h => h.status === 'yapilmadi' || h.status === 'eksik')
  return (
    <section className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4">
      <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">Ödev durumu</h2>
      {dersler.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-slate-400">Bu aralıkta ödev yok.</p>
      ) : (
        <p className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-gray-800 dark:text-slate-200">
          {dersler.map(d => <span key={d.ders}>{dersOzetiMetni(d)}</span>)}
        </p>
      )}
      {sorunlu.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm">
          {sorunlu.map(h => (
            <li key={h.id} className="flex flex-wrap gap-x-2">
              <span className={h.status === 'yapilmadi' ? 'text-red-700 dark:text-red-400 font-medium' : 'text-amber-800 dark:text-amber-400 font-medium'}>
                {h.status === 'yapilmadi' ? 'Yapılmadı' : 'Eksik'}
              </span>
              <span className="text-gray-800 dark:text-slate-200">{h.subject} · {h.title}</span>
              {h.due_date && <span className="text-gray-500 dark:text-slate-400">{format(parseISO(h.due_date), 'd MMM')}</span>}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
