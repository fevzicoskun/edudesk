import { getCurrentUser } from '@/src/shared/auth'
import { AnnouncementRepository } from '@/src/domains/announcements/repositories/AnnouncementRepository'
import { ROLE_LABELS } from '@/src/shared/types'
import { format } from '@/src/shared/date'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'

export default async function MudurSonDuyurular() {
  const user = await getCurrentUser()
  if (!user) return null

  const all = await AnnouncementRepository.listByCreator(user.id)
  const duyurular = all.slice(0, 4)

  return (
    <Card className="border-gray-200 dark:border-slate-700 shadow-sm h-full">
      <CardHeader className="px-4 pt-4 pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-semibold text-gray-700 dark:text-slate-300">
          Son Duyurular
        </CardTitle>
        <Link
          href="/duyurular"
          className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
        >
          Tümü
        </Link>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-3">
        {duyurular.length === 0 && (
          <p className="text-sm text-gray-400 dark:text-slate-500 py-4 text-center">
            Henüz duyuru gönderilmedi.
          </p>
        )}
        {duyurular.map(a => (
          <div
            key={a.id}
            className="rounded-xl border border-gray-100 dark:border-slate-700 p-3 space-y-2"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex flex-wrap gap-1">
                {a.target_roles.map(r => (
                  <Badge key={r} variant="secondary" className="text-[10px] h-4 px-1.5">
                    {ROLE_LABELS[r as keyof typeof ROLE_LABELS] ?? r}
                  </Badge>
                ))}
              </div>
              <span className="text-[10px] text-gray-400 dark:text-slate-500 shrink-0">
                {format(new Date(a.created_at), 'd MMM')}
              </span>
            </div>
            <p className="text-xs text-gray-700 dark:text-slate-300 line-clamp-2 leading-relaxed">
              {a.message}
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
