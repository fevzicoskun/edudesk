import { getCurrentProfile } from '@/src/shared/auth'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { InspectionRepository } from '@/src/domains/inspection/repositories/InspectionRepository'

export default async function SokDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')

  const { data: report } = await InspectionRepository.findSokReport(id, profile.id)
  if (!report) notFound()

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-bold">ŞÖK Tutanağı</h1>
          <p className="text-xs text-gray-500">
            {report.meeting_date} · {report.term}. Dönem · {report.academic_year}
          </p>
        </div>
        <Link href="/profil/dosyam/sok" className="text-xs text-gray-500">← Geri</Link>
      </div>

      <div className="mb-4">
        <div className="text-xs font-semibold text-gray-700 mb-1">Katılımcılar</div>
        <div className="flex flex-wrap gap-1.5">
          {report.participants.map((p, i) => (
            <span key={i} className="text-xs bg-blue-100 text-blue-800 rounded-full px-2 py-0.5">
              {p.full_name}{p.subject ? ` (${p.subject})` : ''}
            </span>
          ))}
        </div>
      </div>

      <div className="mb-4">
        <div className="text-xs font-semibold text-gray-700 mb-2">Gündem Maddeleri</div>
        <div className="flex flex-col gap-1">
          {report.agenda_items.map(item => (
            <div key={item.order}
              className={`border rounded p-2 text-xs ${
                item.discussed ? 'border-emerald-200 bg-emerald-50' : 'border-gray-200'
              }`}>
              <span className={item.discussed ? 'text-emerald-800 font-medium' : 'text-gray-500'}>
                {item.discussed ? '✓ ' : ''}{item.order}. {item.text}
              </span>
              {item.note && <div className="text-gray-500 mt-1 pl-4">{item.note}</div>}
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="text-xs font-semibold text-gray-700 mb-2">Alınan Kararlar</div>
        <div className="flex flex-col gap-1">
          {report.decisions.map(d => (
            <div key={d.order}
              className="text-xs text-gray-700 flex gap-2 border border-gray-100 rounded p-2">
              <span className="text-gray-400">{d.order}.</span>
              <span>{d.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
