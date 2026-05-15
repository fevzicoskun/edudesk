import { getCurrentUser, getCurrentProfile } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ProfilForm from './ProfilForm'
import PasswordForm from './PasswordForm'
import SchoolCodeCard from './SchoolCodeCard'

export default async function ProfilPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const supabase = await createClient()
  const profile = await getCurrentProfile()

  // Okul kodunu getir (sadece başkan için gösterilecek)
  let schoolSlug: string | null = null
  if (profile?.role === 'zumre_baskani' && profile.school_id) {
    const { data: school } = await supabase
      .from('schools')
      .select('slug')
      .eq('id', profile.school_id)
      .single()
    schoolSlug = school?.slug ?? null
  }

  return (
    <div>
      {/* Okul kodu — sadece başkana */}
      {schoolSlug && (
        <div className="px-4 md:px-6 pt-4 md:pt-6 max-w-lg mx-auto">
          <SchoolCodeCard code={schoolSlug} />
        </div>
      )}

      <ProfilForm
        defaultFullName={profile?.full_name ?? ''}
        defaultSubject={profile?.subject ?? ''}
        schoolName={profile?.schools?.name ?? null}
        email={user.email ?? ''}
      />
      <div className="px-4 md:px-6 pb-6 max-w-lg mx-auto">
        <PasswordForm />
      </div>
    </div>
  )
}

