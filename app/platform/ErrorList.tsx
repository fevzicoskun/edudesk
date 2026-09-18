import { createServiceClient } from '@/src/infrastructure/supabase/service'
import { gruplaHatalar, type HamHataSatiri } from '@/src/infrastructure/observability/hataKaydi'

const KAYNAK_ETIKET: Record<string, string> = {
  client: '🖥️ Ekran',
  server: '⚙️ Sunucu',
  cron:   '⏰ Cron',
}

function gecenSure(iso: string): string {
  const dk = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
  if (dk < 1)     return 'az önce'
  if (dk < 60)    return `${dk} dk önce`
  const sa = Math.floor(dk / 60)
  if (sa < 24)    return `${sa} sa önce`
  const gun = Math.floor(sa / 24)
  return `${gun} gün önce`
}

// Son 200 hata kaydı, parmak izine göre gruplanmış.
// Tabloda policy yok (deny-all) → yalnız service-role okur.
export default async function ErrorList() {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('app_errors')
    .select('id, fingerprint, name, message, source, created_at')
    .order('created_at', { ascending: false })
    .limit(200)

  const gruplar = gruplaHatalar((data ?? []) as HamHataSatiri[])
  const sonGun = (data ?? []).filter(
    h => Date.now() - new Date(h.created_at).getTime() < 24 * 60 * 60 * 1000,
  ).length

  return (
    <section>
      <div className="flex items-baseline gap-3 mb-3">
        <h2 className="text-lg font-semibold text-white">Hatalar</h2>
        {sonGun > 0 && (
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-950 text-red-300 border border-red-900">
            son 24 saatte {sonGun}
          </span>
        )}
      </div>

      {gruplar.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-slate-500">
          Kayıtlı hata yok.
        </div>
      ) : (
        <div className="space-y-2">
          {gruplar.map(grup => (
            <div key={grup.fingerprint} className="bg-slate-900 border border-slate-800 rounded-xl px-5 py-3">
              <div className="flex items-center gap-2 text-xs text-slate-400 mb-1.5">
                <span>{KAYNAK_ETIKET[grup.source] ?? grup.source}</span>
                <span>·</span>
                <span className="font-medium text-slate-300">{grup.name}</span>
                {grup.adet > 1 && (
                  <span className="px-1.5 rounded-full bg-slate-800 text-slate-300 tabular-nums">
                    {grup.adet}×
                  </span>
                )}
                <span className="ml-auto tabular-nums">{gecenSure(grup.sonGorulme)}</span>
              </div>
              <p className="text-sm text-slate-200 font-mono whitespace-pre-wrap break-words">
                {grup.message}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
