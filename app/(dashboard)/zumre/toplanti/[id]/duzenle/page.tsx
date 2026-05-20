import { createClient } from '@/src/infrastructure/supabase/server'
import { getCurrentUser } from '@/src/shared/auth'
import { notFound, redirect } from 'next/navigation'
import { updateMeeting } from '@/src/domains/zumre/actions'
import Link from 'next/link'

const inputCls = 'w-full px-3 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400 dark:placeholder:text-slate-400'

export default async function ToplantiDuzenle({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const { id } = await params
  const supabase = await createClient()

  const { data: meeting } = await supabase
    .from('zumre_meetings')
    .select('id, title, meeting_date, notes')
    .eq('id', id)
    .single()

  if (!meeting) notFound()

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <Link href="/zumre?tab=toplanti" className="text-sm text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200 mb-4 inline-block">
        ← Toplantılara dön
      </Link>

      <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100 mb-6">Toplantıyı Düzenle</h1>

      <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-5">
        <form action={updateMeeting.bind(null, id)} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1.5">Başlık</label>
            <input
              name="title"
              type="text"
              required
              defaultValue={meeting.title}
              className={inputCls}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1.5">Tarih</label>
            <input
              name="meeting_date"
              type="date"
              required
              defaultValue={meeting.meeting_date}
              className={inputCls}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1.5">Notlar / Gündem</label>
            <textarea
              name="notes"
              rows={12}
              defaultValue={meeting.notes ?? ''}
              className={inputCls + ' resize-y'}
            />
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              Kaydet
            </button>
            <Link
              href="/zumre?tab=toplanti"
              className="flex-1 text-center bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
            >
              İptal
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
