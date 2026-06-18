import Link from 'next/link'
import type { ChronicAbsentee } from '@/src/domains/attendance/lib/analitik'

export default function KronikSicil({ items }: { items: ChronicAbsentee[] }) {
  return (
    <section className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4 mb-4">
      <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3">Kronik Devamsızlar (özürsüz ≥ 15 gün)</h2>
      {items.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-slate-500">Uyarı eşiğini aşan öğrenci yok. 👍</p>
      ) : (
        <ul className="divide-y divide-gray-100 dark:divide-slate-700">
          {items.map(s => (
            <li key={s.studentId}>
              <Link
                href={`/siniflar/${s.classId}/ogrenciler/${s.studentId}`}
                className="flex items-center gap-3 py-2.5 hover:bg-gray-50 dark:hover:bg-slate-700/50 -mx-2 px-2 rounded-lg transition-colors"
              >
                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${s.level === 'danger' ? 'bg-rose-500' : 'bg-amber-400'}`} />
                <span className="text-sm font-medium text-gray-900 dark:text-slate-100 flex-1 truncate">{s.name}</span>
                <span className="text-xs text-gray-400 dark:text-slate-500 shrink-0">{s.className}</span>
                <span className={`text-xs font-bold w-16 text-right shrink-0 ${s.level === 'danger' ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400'}`}>
                  {s.unexcused % 1 === 0 ? s.unexcused : s.unexcused.toFixed(1)} gün
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
