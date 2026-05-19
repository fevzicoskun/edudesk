import Link from 'next/link'

type MentorEntry = { mentorId: string; count: number; name: string | undefined; subject: string | undefined }

export default function MentorOzetiWidget({ entries }: { entries: MentorEntry[] }) {
  if (entries.length === 0) return null
  return (
    <section className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300">Mentör Rapor Özeti (Son 30 Gün)</h2>
        <Link href="/raporlar/mentor" className="text-xs text-purple-600 font-medium hover:underline">Tümü →</Link>
      </div>
      <ul className="divide-y divide-gray-100 dark:divide-slate-700">
        {entries.map(e => (
          <li key={e.mentorId} className="flex items-center justify-between px-4 py-2.5">
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">
                {e.name ?? 'Bilinmeyen Öğretmen'}
              </p>
              {e.subject && (
                <p className="text-xs text-gray-400 dark:text-slate-500">{e.subject}</p>
              )}
            </div>
            <span className="text-xs font-semibold px-2 py-1 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 shrink-0">
              {e.count} rapor
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
