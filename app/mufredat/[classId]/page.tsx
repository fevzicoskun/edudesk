import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'
import { notFound } from 'next/navigation'
import { parseTopicString } from '@/lib/tymm-data'

const STATUS_TR: Record<string, string> = {
  tamamlandi: 'Tamamlandı',
  tekrar_gerekli: 'Tekrar Gerekli',
  eksik_kaldi: 'Eksik Kaldı',
}

export default async function MufredatYazdirPage({ params }: { params: Promise<{ classId: string }> }) {
  const { classId } = await params
  const user = await getCurrentUser()
  if (!user) notFound()

  const supabase = await createClient()

  const [{ data: cls }, { data: rawTopics }] = await Promise.all([
    supabase.from('classes').select('name, grade').eq('id', classId).single(),
    supabase
      .from('curriculum_progress')
      .select('id, topic, week_number, status')
      .eq('class_id', classId)
      .eq('teacher_id', user.id)
      .order('week_number', { nullsFirst: true })
      .order('created_at'),
  ])

  if (!cls) notFound()

  const topics = rawTopics ?? []
  const done = topics.filter(t => t.status === 'tamamlandi').length
  const pct = topics.length ? Math.round((done / topics.length) * 100) : 0

  const byWeek = new Map<number | null, typeof topics>()
  for (const t of topics) {
    const w = t.week_number
    if (!byWeek.has(w)) byWeek.set(w, [])
    byWeek.get(w)!.push(t)
  }
  const sortedWeeks = [...byWeek.keys()].sort((a, b) => {
    if (a === null) return 1
    if (b === null) return -1
    return a - b
  })

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-8 print:p-4 font-sans text-sm text-gray-900">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-1 print:hidden">
        <h1 className="text-xl font-bold">Müfredat Raporu — {cls.name}</h1>
        <button
          onClick={() => window.print()}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          suppressHydrationWarning
        >
          Yazdır / PDF
        </button>
      </div>
      <div className="print:block hidden mb-4">
        <h1 className="text-xl font-bold">{cls.name} — Müfredat Takip Raporu</h1>
      </div>

      <div className="flex flex-wrap gap-3 md:gap-6 mb-6 text-xs text-gray-500">
        <span>Toplam: <strong className="text-gray-900">{topics.length}</strong></span>
        <span>Tamamlanan: <strong className="text-green-700">{done}</strong></span>
        <span>Tamamlanma: <strong className="text-blue-700">%{pct}</strong></span>
      </div>

      {sortedWeeks.map(week => (
        <div key={String(week)} className="mb-4 break-inside-avoid">
          {week !== null && (
            <div className="bg-gray-100 px-3 py-1.5 rounded font-semibold text-xs text-gray-600 mb-1">
              Hafta {week}
            </div>
          )}
          <table className="w-full border-collapse text-sm">
            <tbody>
              {(byWeek.get(week) ?? []).map(t => {
                const { code, topic } = parseTopicString(t.topic)
                const statusStyle =
                  t.status === 'tamamlandi' ? 'text-green-700' :
                  t.status === 'tekrar_gerekli' ? 'text-yellow-700' : 'text-red-600'
                return (
                  <tr key={t.id} className="border-b border-gray-100">
                    <td className="py-1.5 pr-3 w-24 font-mono text-[11px] text-gray-400">{code}</td>
                    <td className="py-1.5 flex-1">{topic}</td>
                    <td className={`py-1.5 pl-3 text-right text-xs font-medium ${statusStyle}`}>
                      {STATUS_TR[t.status] ?? t.status}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ))}

      <p className="text-xs text-gray-400 mt-8 print:mt-4">
        EduDesk · {new Date().toLocaleDateString('tr-TR')}
      </p>
    </div>
  )
}
