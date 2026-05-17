import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import OnboardingForm from './OnboardingForm'

export default async function OnboardingPage() {
  const profile = await getCurrentProfile()

  if (!profile || profile.role !== 'mudur') redirect('/anasayfa')

  // Kurulum zaten tamamsa dashboard'a geç
  if (profile.school_id) {
    const supabase = await createClient()
    const { data: school } = await supabase
      .from('schools')
      .select('name, slug')
      .eq('id', profile.school_id)
      .single()

    const slug = school?.slug ?? ''
    if (/^[A-Z]{3}\d{3}$/.test(slug)) redirect('/anasayfa')

    return (
      <OnboardingForm
        existingName={school?.name ?? ''}
        fullName={profile.full_name ?? ''}
      />
    )
  }

  return <OnboardingForm existingName="" fullName={profile.full_name ?? ''} />
}
