import { getCurrentUser, requireSchoolId } from '@/src/shared/auth'
import { AnnouncementRepository } from '@/src/domains/announcements/repositories/AnnouncementRepository'
import { ROLE_LABELS } from '@/src/shared/types'
import { format } from '@/src/shared/date'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'

export default async function MudurSonDuyurular() {
  const [user, school_id] = await Promise.all([getCurrentUser(), requireSchoolId()])
  if (!user) return null

  const duyurular = await AnnouncementRepository.listBySchool(school_id)

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
          Tümü →
        </Link>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-3">
        {duyurular.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <p className="text-sm text-gray-400 dark:text-slate-500">
              Henüz duyuru gönderilmedi.
            </p>
            <Link
              href="/duyurular"
              className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
            >
              + Yeni Duyuru Oluştur
            </Link>
          </div>
        )}
        {duyurular.map(a => (
          <div
            key={a.id}
            className="rounded-xl border border-gray-100 dark:border-slate-700 p-3 space-y-2"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex flex-wrap gap-1 min-w-0">
                {a.target_roles.map(r => (
                  <Badge key={r} variant="secondary" className="text-[10px] h-4 px-1.5">
                    {ROLE_LABELS[r as keyof typeof ROLE_LABELS] ?? r}
                  </Badge>
                ))}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {a.created_by === user.id && (
                  <span className="text-[10px] font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-1.5 py-0.5 rounded-full">
                    Ben
                  </span>
                )}
                <span className="text-[10px] text-gray-400 dark:text-slate-500">
                  {format(new Date(a.created_at), 'd MMM')}
                </span>
              </div>
            </div>
            <p className="text-xs text-gray-700 dark:text-slate-300 line-clamp-2 leading-relaxed">
              {a.message}
            </p>
            <p className="text-[10px] text-gray-400 dark:text-slate-500">{a.sender_name}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
