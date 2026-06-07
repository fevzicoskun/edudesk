import { redirect } from 'next/navigation'
import { getCurrentUser, getCurrentProfile } from '@/src/shared/auth'
import MudurOnboardingForm from './MudurOnboardingForm'
import JoinSchoolForm from './JoinSchoolForm'

export default async function OnboardingPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const profile = await getCurrentProfile()

  // Müdür akışı: okul adı + kod üretimi
  if (profile?.role === 'mudur') {
    if (!profile.school_id) redirect('/login')

    const slug = profile.schools?.slug ?? ''
    // Kurulum tamamsa dashboard'a geç
    if (/^[A-Z]{3,4}\d{3,4}$/.test(slug)) redirect('/anasayfa')

    return (
      <MudurOnboardingForm
        existingName={profile.schools?.name ?? ''}
        fullName={profile.full_name ?? ''}
      />
    )
  }

  // Diğer roller: okula katılım (school_id yoksa)
  if (profile?.school_id) redirect('/anasayfa')

  return <JoinSchoolForm />
}
