import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/src/shared/auth'
import { AnnouncementService } from '@/src/domains/announcements/services/AnnouncementService'
import { MUDUR_TARGET_ROLES, MY_TARGET_ROLES } from '@/src/domains/announcements/validators'
import { ROLE_LABELS } from '@/src/shared/types'
import { format } from '@/src/shared/date'
import DuyuruForm from './DuyuruForm'
import ZumreDuyuruForm from '../zumre-duyuru/ZumreDuyuruForm'

export const dynamic = 'force-dynamic'

const ALLOWED = ['mudur', 'mudur_yardimcisi', 'zumre_baskani']

export default async function DuyurularPage() {
  const profile = await getCurrentProfile()
  if (!profile || !ALLOWED.includes(profile.role)) {
    redirect('/anasayfa')
  }

  const isZumreBaskani = profile.role === 'zumre_baskani'
  const allowedRoles = profile.role === 'mudur' ? MUDUR_TARGET_ROLES : MY_TARGET_ROLES
  const sent = isZumreBaskani ? [] : await AnnouncementService.listSent()

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">Duyurular</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
          {isZumreBaskani
            ? `${profile.subject ?? ''} zümresine bildirim gönder`
            : 'Hedef gruba duyuru gönderin'}
        </p>
      </div>

      {isZumreBaskani ? (
        <ZumreDuyuruForm />
      ) : (
        <>
          <DuyuruForm allowedRoles={allowedRoles as readonly string[]} />
          {sent.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">
                Gönderilen Duyurular
              </h2>
              <div className="space-y-2">
                {sent.map(a => (
                  <div
                    key={a.id}
                    className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex flex-wrap gap-1">
                        {a.target_roles.map(r => (
                          <span
                            key={r}
                            className="text-[11px] px-2 py-0.5 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 rounded-full font-medium"
                          >
                            {ROLE_LABELS[r as keyof typeof ROLE_LABELS] ?? r}
                          </span>
                        ))}
                      </div>
                      <span className="text-xs text-gray-400 dark:text-slate-500 shrink-0">
                        {format(new Date(a.created_at), 'd MMM yyyy')}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 dark:text-slate-300 line-clamp-3 whitespace-pre-wrap">
                      {a.message}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
