// app/(dashboard)/profil/dosyam/yillik-plan/page.tsx
import { getCurrentProfile } from '@/src/shared/auth'
import { redirect }          from 'next/navigation'
import { AnnualPlanService } from '@/src/domains/inspection/services/AnnualPlanService'
import { approveAnnualPlanAction } from '@/app/actions/inspection'

function getCurrentAcademicYear(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const start = month >= 9 ? year : year - 1
  return `${start}-${start + 1}`
}

export default async function YillikPlanPage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')

  // Grade hardcoded to 10 for now; will be added to profile in a future sprint.
  const grade = 10
  const academicYear = getCurrentAcademicYear()

  const result = await AnnualPlanService.getOrCreate(grade, 'Matematik', academicYear)

  if ('error' in result) {
    return <div className="text-red-500 text-sm p-4">{result.error}</div>
  }

  const plan = result.data!

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-bold">Yıllık Plan</h1>
          <p className="text-xs text-gray-500">{plan.academic_year} · {plan.subject}</p>
        </div>
        <div className="flex items-center gap-2">
          {plan.approved_at ? (
            <span className="text-xs bg-emerald-100 text-emerald-700 rounded-full px-3 py-1">
              ✓ Onaylı
            </span>
          ) : (
            <form action={async () => { 'use server'; await approveAnnualPlanAction(plan.id) }}>
              <button
                type="submit"
                className="text-xs bg-blue-600 text-white rounded-lg px-3 py-1.5"
              >
                Onayla
              </button>
            </form>
          )}
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-xs">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left font-semibold text-gray-600 w-12">Hafta</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-600 w-24">Tarihler</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-600">Konular</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {plan.weekly_plan.map(week => (
              <tr key={week.week} className="hover:bg-gray-50">
                <td className="px-3 py-2 text-gray-500">{week.week}</td>
                <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{week.dates}</td>
                <td className="px-3 py-2 text-gray-700">{week.topics.join(', ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
