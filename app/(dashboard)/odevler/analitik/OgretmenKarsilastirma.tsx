import type { TeacherStat } from '@/src/domains/homework/lib/analitik'

export default function OgretmenKarsilastirma({ stats }: { stats: TeacherStat[] }) {
  if (stats.length === 0) return null

  return (
    <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-5 mt-6">
      <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-4">Öğretmen Karşılaştırması</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 dark:border-slate-700">
              <th className="text-left text-xs font-medium text-gray-500 dark:text-slate-400 pb-2 pr-4">Öğretmen</th>
              <th className="text-right text-xs font-medium text-gray-500 dark:text-slate-400 pb-2 pr-4">Ödev</th>
              <th className="text-right text-xs font-medium text-gray-500 dark:text-slate-400 pb-2 pr-4">Ort. Tamamlanma</th>
              <th className="text-right text-xs font-medium text-gray-500 dark:text-slate-400 pb-2">Risk Öğrenci</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50">
            {stats.map(s => (
              <tr key={s.teacher_id}>
                <td className="py-2.5 pr-4 font-medium text-gray-900 dark:text-slate-100 truncate max-w-[150px]">
                  {s.full_name}
                </td>
                <td className="py-2.5 pr-4 text-right text-gray-700 dark:text-slate-300">{s.homeworkCount}</td>
                <td className="py-2.5 pr-4 text-right">
                  <span className={`font-semibold ${
                    s.avgCompletionPct >= 70 ? 'text-green-600 dark:text-green-400' :
                    s.avgCompletionPct >= 50 ? 'text-yellow-600 dark:text-yellow-400' :
                    'text-red-600 dark:text-red-400'
                  }`}>
                    %{s.avgCompletionPct}
                  </span>
                </td>
                <td className="py-2.5 text-right">
                  {s.riskyStudentCount > 0 ? (
                    <span className="text-red-600 dark:text-red-400 font-semibold">{s.riskyStudentCount}</span>
                  ) : (
                    <span className="text-gray-500 dark:text-slate-400">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
