import { createServiceClient } from '@/src/infrastructure/supabase/service'

// Okul bazında kullanım özeti — usage_summary / usage_active_users view'ları (son 30 gün)
export default async function UsageSummary() {
  const supabase = createServiceClient()
  const [{ data: active }, { data: summary }] = await Promise.all([
    supabase.from('usage_active_users').select('*').order('users_30d', { ascending: false }),
    supabase.from('usage_summary').select('*').order('views_30d', { ascending: false }),
  ])

  if (!active?.length) {
    return (
      <section>
        <h2 className="text-lg font-semibold text-white mb-3">Kullanım</h2>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-slate-500">
          Henüz kullanım verisi yok.
        </div>
      </section>
    )
  }

  return (
    <section>
      <h2 className="text-lg font-semibold text-white mb-3">Kullanım (son 30 gün)</h2>
      <div className="space-y-3">
        {active.map(school => {
          const topFeatures = (summary ?? [])
            .filter(r => r.school_id === school.school_id)
            .slice(0, 5)
          return (
            <div key={school.school_id} className="bg-slate-900 border border-slate-800 rounded-xl px-5 py-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-white">{school.school_name}</p>
                <p className="text-xs text-slate-400">
                  Aktif kullanıcı: <span className="text-emerald-400 font-semibold">{school.users_7d ?? 0}</span> (7g)
                  {' · '}
                  <span className="text-sky-400 font-semibold">{school.users_30d ?? 0}</span> (30g)
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {topFeatures.map(f => (
                  <span key={String(f.feature)} className="text-xs bg-slate-800 text-slate-300 rounded-full px-2.5 py-1">
                    {f.feature} · {f.views_30d ?? 0}
                  </span>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
