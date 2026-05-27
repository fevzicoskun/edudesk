import { getCurrentProfile } from '@/src/shared/auth'
import { redirect }          from 'next/navigation'
import Link                  from 'next/link'
import { InspectionRepository } from '@/src/domains/inspection/repositories/InspectionRepository'

export default async function GunlukPlanListPage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')

  const { data: plansData } = await InspectionRepository.findDailyPlans(profile.id, profile.school_id)
  const plans = plansData ?? []

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <Link href="/profil/dosyam" className="text-xs text-gray-500 mb-4 inline-block">← Dosyam</Link>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-bold">Günlük Ders Planları</h1>
        <Link
          href="/profil/dosyam/gunluk-plan/yeni"
          className="text-sm bg-blue-600 text-white rounded-lg px-3 py-1.5"
        >
          + Yeni Plan
        </Link>
      </div>
      {plans.length === 0 ? (
        <p className="text-gray-500 text-sm">Henüz günlük plan eklenmemiş.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {plans.map(plan => (
            <Link
              key={plan.id}
              href={`/profil/dosyam/gunluk-plan/${plan.id}`}
              className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50 flex items-center justify-between"
            >
              <div>
                <div className="text-sm font-medium">{plan.topic}</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {plan.plan_date} · {plan.lesson_hour}. Saat · {plan.unit}
                </div>
              </div>
              <span className="text-xs text-gray-400">Düzenle →</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
