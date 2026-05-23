import { redirect } from 'next/navigation'
import { AnnouncementService } from '@/src/domains/announcements/services/AnnouncementService'
import { markAnnouncementRead } from '@/app/actions/announcements'
import { format } from '@/src/shared/date'

export const dynamic = 'force-dynamic'

export default async function DuyuruPage() {
  const announcement = await AnnouncementService.getFirstUnread()
  if (!announcement) redirect('/anasayfa')

  const tarih = format(new Date(announcement.created_at), 'd MMMM yyyy')
  const readAction = markAnnouncementRead.bind(null, announcement.id)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/95 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-white dark:bg-slate-800 rounded-2xl shadow-2xl overflow-hidden">

        <div className="bg-blue-600 dark:bg-blue-700 px-6 py-4 flex items-center gap-3">
          <div className="flex-shrink-0 w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
            </svg>
          </div>
          <div>
            <h1 className="text-white font-semibold text-base leading-tight">Okul Duyurusu</h1>
            <p className="text-blue-200 text-xs mt-0.5">{announcement.sender_name} · {tarih}</p>
          </div>
        </div>

        <div className="px-6 py-6">
          <p className="text-gray-800 dark:text-slate-100 text-base leading-relaxed whitespace-pre-wrap">
            {announcement.message}
          </p>
        </div>

        <div className="px-6 pb-6">
          <form action={readAction}>
            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold py-3 px-4 rounded-xl transition-colors text-sm"
            >
              Okudum, Devam Et
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
