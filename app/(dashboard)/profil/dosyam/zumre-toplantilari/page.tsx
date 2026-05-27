// app/(dashboard)/profil/dosyam/zumre-toplantilari/page.tsx
import { getCurrentProfile } from '@/src/shared/auth'
import { redirect }          from 'next/navigation'
import Link                  from 'next/link'
import { createClient }      from '@/src/infrastructure/supabase/server'

export default async function ZumreToplantilariPage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')

  const supabase = await createClient()
  const { data: meetings } = await supabase
    .from('zumre_meetings')
    .select('id, title, meeting_date, notes, created_at')
    .order('meeting_date', { ascending: false })

  const list = meetings ?? []

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <Link href="/profil/dosyam" className="text-xs text-gray-500 mb-4 inline-block">← Dosyam</Link>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-bold">Zümre Toplantı Raporları</h1>
        <span className="text-xs text-gray-400">{list.length} kayıt</span>
      </div>

      {list.length === 0 ? (
        <div className="text-center py-12 text-gray-400 border rounded-xl border-dashed">
          <p className="text-sm">Henüz zümre toplantı kaydı bulunmuyor.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {list.map(m => (
            <div key={m.id} className="border border-gray-200 rounded-lg px-4 py-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-gray-800">{m.title}</p>
                  {m.notes && (
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">{m.notes}</p>
                  )}
                </div>
                <span className="text-xs text-gray-400 whitespace-nowrap shrink-0">
                  {new Date(m.meeting_date).toLocaleDateString('tr-TR', {
                    day: '2-digit', month: 'long', year: 'numeric',
                  })}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
