import { getCurrentUser, getCurrentProfile } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ProfilForm from './ProfilForm'
import PasswordForm from './PasswordForm'
import SetupBanner from '@/components/SetupBanner'
import CopyCodeButton from './CopyCodeButton'

const OKUL_ADI_SQL = `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS okul_adi TEXT;`

export default async function ProfilPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const supabase = await createClient()
  const probeRes = await supabase.from('profiles').select('okul_adi').eq('id', user.id).single()
  const okulAdiMissing = probeRes.error?.code === '42703'

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
      {okulAdiMissing && (
        <div className="px-4 md:px-6 pt-4 md:pt-6 max-w-lg mx-auto">
          <SetupBanner title="Kurulum gerekiyor — okul_adi kolonu eksik" sql={OKUL_ADI_SQL} />
        </div>
      )}

      {/* Okul kodu — sadece başkana */}
      {schoolSlug && (
        <div className="px-4 md:px-6 pt-4 md:pt-6 max-w-lg mx-auto">
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3">
            <p className="text-xs font-semibold text-indigo-700 mb-1">Okul Katılım Kodu</p>
            <p className="text-xs text-indigo-600 mb-2">
              Bu kodu öğretmenlerinizle paylaşın. Onboarding sırasında &quot;Okula Katıl&quot; seçeneğiyle girecekler.
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-white border border-indigo-200 rounded-lg px-3 py-2 text-sm font-mono text-indigo-900 select-all">
                {schoolSlug}
              </code>
              <CopyCodeButton code={schoolSlug} />
            </div>
          </div>
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

