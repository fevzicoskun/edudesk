import { redirect } from 'next/navigation'
import { getCurrentUser, getCurrentProfile } from '@/src/shared/auth'
import { createClient } from '@/src/infrastructure/supabase/server'
import MudurOnboardingForm from './MudurOnboardingForm'
import JoinSchoolForm from './JoinSchoolForm'

export default async function OnboardingPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const profile = await getCurrentProfile()

  // Müdür akışı: okul adı + kod üretimi
  if (profile?.role === 'mudur') {
    if (!profile.school_id) redirect('/login')

    const supabase = await createClient()
    const { data: school } = await supabase
      .from('schools')
      .select('name, slug')
      .eq('id', profile.school_id)
      .single()

    const slug = school?.slug ?? ''
    // Kurulum tamamsa dashboard'a geç
    if (/^[A-Z]{3}\d{3}$/.test(slug)) redirect('/anasayfa')

    return (
      <MudurOnboardingForm
        existingName={school?.name ?? ''}
        fullName={profile.full_name ?? ''}
      />
    )
  }

  // Diğer roller: okula katılım (school_id yoksa)
  if (profile?.school_id) redirect('/anasayfa')

  return <JoinSchoolForm />
}
