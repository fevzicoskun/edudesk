import { createServiceClient } from '@/src/infrastructure/supabase/service'

const CATEGORY_BADGES: Record<string, string> = {
  oneri:   '💡 Öneri',
  istek:   '🙏 İstek',
  sikayet: '⚠️ Şikayet',
}

// Son 50 geri bildirim — yalnızca service-role okuyabilir (tabloda SELECT policy yok)
export default async function FeedbackList() {
  const supabase = createServiceClient()
  const { data: items } = await supabase
    .from('feedback')
    .select('id, role, page_path, category, message, created_at, schools(name)')
    .order('created_at', { ascending: false })
    .limit(50)

  return (
    <section>
      <h2 className="text-lg font-semibold text-white mb-3">Geri Bildirimler</h2>
      {!items?.length ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-slate-500">
          Henüz geri bildirim yok.
        </div>
      ) : (
        <div className="space-y-2">
          {items.map(item => (
            <div key={item.id} className="bg-slate-900 border border-slate-800 rounded-xl px-5 py-3">
              <div className="flex items-center gap-2 text-xs text-slate-400 mb-1.5">
                <span>{CATEGORY_BADGES[item.category] ?? item.category}</span>
                <span>·</span>
                <span>{item.schools?.name ?? '—'}</span>
                <span>·</span>
                <span>{item.role}</span>
                <span>·</span>
                <span>{item.page_path}</span>
                <span className="ml-auto">
                  {new Date(item.created_at).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })}
                </span>
              </div>
              <p className="text-sm text-slate-200 whitespace-pre-wrap">{item.message}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
