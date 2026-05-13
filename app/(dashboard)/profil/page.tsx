import { getCurrentUser, getCurrentProfile } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ProfilForm from './ProfilForm'
import PasswordForm from './PasswordForm'
import SetupBanner from '@/components/SetupBanner'

const OKUL_ADI_SQL = `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS okul_adi TEXT;`

export default async function ProfilPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const supabase = await createClient()
  const probeRes = await supabase.from('profiles').select('okul_adi').eq('id', user.id).single()
  const okulAdiMissing = probeRes.error?.code === '42703'

  const profile = await getCurrentProfile()

  return (
    <div>
      {okulAdiMissing && (
        <div className="px-4 md:px-6 pt-4 md:pt-6 max-w-lg mx-auto">
          <SetupBanner title="Kurulum gerekiyor — okul_adi kolonu eksik" sql={OKUL_ADI_SQL} />
        </div>
      )}
      <ProfilForm
        defaultFullName={profile?.full_name ?? ''}
        defaultSubject={profile?.subject ?? ''}
        defaultOkulAdi={(profile as unknown as { okul_adi?: string })?.okul_adi ?? ''}
        email={user.email ?? ''}
      />
      <div className="px-4 md:px-6 pb-6 max-w-lg mx-auto">
        <PasswordForm />
      </div>
    </div>
  )
}
