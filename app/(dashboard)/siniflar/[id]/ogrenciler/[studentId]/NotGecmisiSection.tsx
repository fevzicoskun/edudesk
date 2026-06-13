import { format, parseISO } from '@/src/shared/date'

type GradeRow = {
  score: number | null
  grade_columns: { title: string; grade_type: string; max_score: number; exam_date: string | null; class_id: string }
}

const GRADE_TYPE_LABELS: Record<string, string> = {
  yazili: 'Yazılı', quiz: 'Quiz', proje: 'Proje', odev: 'Ödev', performans: 'Performans',
}

export default function NotGecmisiSection({ grades }: { grades: GradeRow[] }) {
  if (grades.length === 0) return null

  const avg = (() => {
    const scored = grades.filter(g => g.score != null)
    if (scored.length <= 1) return null
    return scored.reduce((sum, g) => sum + ((g.score! / g.grade_columns.max_score) * 100), 0) / scored.length
  })()

  return (
    <section className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4 mt-4">
      <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3">Not Defteri</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 dark:border-slate-700">
              <th className="text-left text-xs font-medium text-gray-500 dark:text-slate-400 pb-2 pr-4">Sınav / Etkinlik</th>
              <th className="text-left text-xs font-medium text-gray-500 dark:text-slate-400 pb-2 pr-4">Tür</th>
              <th className="text-right text-xs font-medium text-gray-500 dark:text-slate-400 pb-2 pr-4">Puan</th>
              <th className="text-right text-xs font-medium text-gray-500 dark:text-slate-400 pb-2">Tarih</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50">
            {grades.map((g, i) => {
              const pct = g.score != null && g.grade_columns.max_score > 0 ? g.score / g.grade_columns.max_score : null
              return (
                <tr key={`${g.grade_columns.title}-${g.grade_columns.exam_date ?? i}`}>
                  <td className="py-2 pr-4 font-medium text-gray-900 dark:text-slate-100">{g.grade_columns.title}</td>
                  <td className="py-2 pr-4 text-gray-500 dark:text-slate-400 text-xs">{GRADE_TYPE_LABELS[g.grade_columns.grade_type] ?? g.grade_columns.grade_type}</td>
                  <td className="py-2 pr-4 text-right">
                    {g.score != null ? (
                      <span className={`font-bold ${pct != null && pct >= 0.7 ? 'text-green-600 dark:text-green-400' : pct != null && pct >= 0.5 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'}`}>
                        {g.score}
                        <span className="text-xs font-normal text-gray-400 dark:text-slate-500"> / {g.grade_columns.max_score}</span>
                      </span>
                    ) : (
                      <span className="text-gray-400 dark:text-slate-500">—</span>
                    )}
                  </td>
                  <td className="py-2 text-right text-xs text-gray-400 dark:text-slate-500">
                    {g.grade_columns.exam_date ? format(parseISO(g.grade_columns.exam_date), 'd MMM yyyy') : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
          {avg != null && (
            <tfoot>
              <tr className="border-t border-gray-200 dark:border-slate-600">
                <td colSpan={2} className="pt-2 text-xs text-gray-500 dark:text-slate-400 font-medium">Ortalama (100 üzerinden)</td>
                <td className="pt-2 text-right font-bold text-gray-900 dark:text-slate-100">{Math.round(avg)}</td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </section>
  )
}
