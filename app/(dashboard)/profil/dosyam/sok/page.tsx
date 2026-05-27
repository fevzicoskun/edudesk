import { getCurrentProfile } from '@/src/shared/auth'
import { redirect }          from 'next/navigation'
import Link                  from 'next/link'
import { InspectionRepository } from '@/src/domains/inspection/repositories/InspectionRepository'

export default async function SokListPage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')

  const { data: reportsData } = await InspectionRepository.findSokReports(profile.id, profile.school_id)
  const reports = reportsData ?? []

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <Link href="/profil/dosyam" className="text-xs text-gray-500 mb-4 inline-block">← Dosyam</Link>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-bold">ŞÖK Tutanakları</h1>
        <Link href="/profil/dosyam/sok/yeni"
          className="text-sm bg-blue-600 text-white rounded-lg px-3 py-1.5">
          + Yeni Tutanak
        </Link>
      </div>
      {reports.length === 0 ? (
        <p className="text-gray-500 text-sm">Bu dönem tutanak yok.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {reports.map(r => (
            <Link key={r.id} href={`/profil/dosyam/sok/${r.id}`}
              className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50 flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">{r.meeting_date} · {r.term}. Dönem</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {r.participants.length} katılımcı · {r.academic_year}
                </div>
              </div>
              <span className="text-xs text-gray-400">Detay →</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
