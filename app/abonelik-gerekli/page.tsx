import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/src/shared/auth'
import { isMudurOrAbove } from '@/src/shared/types'
import { subscriptionState } from '@/src/domains/billing/subscriptionMath'
import { todayLocalISO } from '@/src/shared/date'
import { logout } from '@/app/actions/auth'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Abonelik Gerekli', robots: { index: false, follow: false } }

export default async function AbonelikGerekliPage() {
  const profile = await getCurrentProfile()
  if (!profile?.school_id) redirect('/login')

  // Abonelik aktifse burada işi yok — kilitli olmayan kullanıcı takılı kalmasın.
  const state = profile.schools
    ? subscriptionState(profile.schools, todayLocalISO())
    : 'active'
  if (state !== 'expired' && state !== 'suspended') redirect('/anasayfa')

  const yonetici = isMudurOrAbove(profile.role)

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-950 px-4">
      <div className="max-w-md w-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-8 text-center">
        <p className="text-5xl">🔒</p>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-slate-100 mt-4">
          {profile.schools?.name ?? 'Okulunuz'} — abonelik sona erdi
        </h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-3">
          {yonetici
            ? 'Aboneliğinizi yenilemek için bizimle iletişime geçin. Ödemeniz işlendiğinde erişim kendiliğinden açılır; verileriniz güvende.'
            : 'Okulunuzun aboneliği sona erdi. Lütfen okul yöneticinizle görüşün; verileriniz güvende.'}
        </p>
        <form action={logout} className="mt-6">
          <button
            type="submit"
            className="border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
          >
            Çıkış yap
          </button>
        </form>
      </div>
    </div>
  )
}
