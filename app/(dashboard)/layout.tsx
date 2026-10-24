import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getCurrentUser, getCurrentProfile } from '@/src/shared/auth'
import Filigran from '@/components/Filigran'
import Sidebar from '@/components/layout/Sidebar'
import TopBar from '@/components/layout/TopBar'
import { ToastProvider } from '@/components/Toast'
import QuickAddDrawer from '@/components/homework/QuickAddDrawer'
import CommandPalette from '@/components/CommandPalette'
import { isTeachingRole, isMudurOrAbove } from '@/src/shared/types'
import PushTesvikSeridi from './PushTesvikSeridi'
import UsageTracker from './UsageTracker'
import AbonelikUyariSeridi from './AbonelikUyariSeridi'
import { subscriptionState, kalanGun } from '@/src/domains/billing/subscriptionMath'
import { todayLocalISO } from '@/src/shared/date'
import { logger } from '@/src/infrastructure/observability/logger'
import { MentorRepository } from '@/src/domains/mentor/repositories/MentorRepository'
import { TakipRepository } from '@/src/domains/mentor/repositories/TakipRepository'
import { BireyselOdevRepository } from '@/src/domains/bireyselOdev/repositories/BireyselOdevRepository'
import { okulYoklamaAktif } from '@/src/domains/school/okulYoklama'

// Sekme/PDF dosya adı ve tarayıcının kâğıda bastığı başlık: "Sayfa · Okul adı" (kökteki "· EduDesk" yerine)
export async function generateMetadata(): Promise<Metadata> {
  const okul = (await getCurrentProfile())?.schools?.name
  return okul ? { title: { template: `%s · ${okul}`, default: okul } } : {}
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const profile = await getCurrentProfile()
  // Profili olmayan veya okula bağlı olmayan kullanıcı (proxy'deki ek profiles okumasının yerine)
  if (!profile?.school_id) redirect('/onboarding')

  // Mentörlük menüde yalnız en az bir öğrencisi olan öğretmende görünür (okuma hatası = gizli, sayfa yine açılır)
  // Yoklama menüleri okul ayarına bağlı (okul yoksa / okunamazsa açık sayılır). İki okuma paralel.
  // Menüde Mentörlük altında öğrenci öğrenci "Haftalık planlar" (yalnız haftalık takip açık mentörde; hata = liste yok)
  // "Verdiğim Bireysel Ödevler" yalnız en az bir bireysel ödev vermiş öğretmende (2026-10-24; hata = gizli)
  const [mentiler, yoklamaAktif, takipAcik, bireyselVar] = await Promise.all([
    isTeachingRole(profile?.role) && profile?.school_id
      ? MentorRepository.listMentorships(user.id, profile.school_id).then(({ data }) => (data ?? [])
          .map(r => ({ id: r.student_id, ad: (r.students as { full_name: string }).full_name }))
          .sort((a, b) => a.ad.localeCompare(b.ad, 'tr')))
      : [],
    profile?.school_id ? okulYoklamaAktif(profile.school_id) : true,
    isTeachingRole(profile?.role) ? TakipRepository.acikMi().catch(() => false) : false,
    isTeachingRole(profile?.role) ? BireyselOdevRepository.varMi(user.id, profile.school_id).catch(() => false) : false,
  ])
  const mentorMu = mentiler.length > 0

  // Abonelik enforcement (fail-open: schools okunamazsa geçir — tahsilat güvenlik sınırı değil).
  let abonelikUyari: number | null = null
  if (profile?.school_id) {
    if (!profile.schools) {
      logger.error({ event: 'abonelik_schools_missing', userId: profile.id }, 'Profile schools join boş — enforcement atlandı')
    } else {
      const today = todayLocalISO()
      const state = subscriptionState(profile.schools, today)
      if (state === 'expired' || state === 'suspended') redirect('/abonelik-gerekli')
      if (state === 'expiring' && isMudurOrAbove(profile.role) && profile.schools.access_until) {
        abonelikUyari = kalanGun(profile.schools.access_until, today)
      }
    }
  }

  // Müdür için onboarding kontrolü — slug artık getCurrentProfile()'dan geliyor, ekstra sorgu yok
  if (profile?.role === 'mudur' && profile.school_id) {
    const slug = profile.schools?.slug ?? ''
    if (!/^[A-Z]{3,4}\d{3,4}$/.test(slug)) {
      redirect('/onboarding')
    }
  }

  return (
    <ToastProvider>
      <UsageTracker />
      <Filigran />
      <div className="flex h-full bg-gray-50 dark:bg-slate-950 print:bg-white">
        {/* flex: içindeki <aside> satırın tam yüksekliğine uzasın (yoksa beyaz menü içerik bitince kesilir) */}
        <div className="flex print:hidden">
          <Sidebar profile={profile} email={user.email ?? ''} mentorMu={mentorMu} yoklamaAktif={yoklamaAktif} bireyselVar={bireyselVar} planOgrencileri={takipAcik ? mentiler : []} />
        </div>
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <div className="print:hidden">
            <TopBar userId={profile?.id} />
          </div>
          {/* öğretmen rollerinde sağ altta "+" (hızlı ödev) düğmesi var: masaüstünde son içerik onun altında kalmasın */}
          <main className={`flex-1 overflow-auto pt-14 md:pt-0 pb-16 ${isTeachingRole(profile?.role) ? 'md:pb-24' : 'md:pb-0'} mobile-main print:overflow-visible print:pt-0 print:pb-0`}>{abonelikUyari !== null && <AbonelikUyariSeridi kalan={abonelikUyari} />}<PushTesvikSeridi />{children}</main>
        </div>
      </div>
      <div className="print:hidden">
        {isTeachingRole(profile?.role) && <QuickAddDrawer />}
        <CommandPalette />
      </div>
    </ToastProvider>
  )
}
