import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/src/shared/auth'
import ZumreDuyuruForm from './ZumreDuyuruForm'

export default async function ZumreDuyuruPage() {
  const profile = await getCurrentProfile()
  if (!profile || profile.role !== 'zumre_baskani') redirect('/anasayfa')

  return (
    <div className="p-4 md:p-6 max-w-xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">Zümre Bildirimi</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
          {profile.subject ? `${profile.subject} branşındaki öğretmenlerin bildirim kutusuna düşer` : 'Zümre öğretmenlerinin bildirim kutusuna düşer'}
        </p>
      </div>

      <ZumreDuyuruForm />
    </div>
  )
}
