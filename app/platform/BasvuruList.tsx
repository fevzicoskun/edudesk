import { createServiceClient } from '@/src/infrastructure/supabase/service'
import BasvuruDurum from './BasvuruDurum'

// Okul başvuruları (/kayit formu) — yalnız service-role okur (tabloda policy yok)
export default async function BasvuruList() {
  const { data: items, error } = await createServiceClient()
    .from('okul_basvurulari')
    .select('id, created_at, school_name, contact_name, email, phone, note, durum')
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) throw new Error(`Başvurular okunamadı: ${error.message}`)
  const yeni = (items ?? []).filter(i => i.durum === 'yeni').length

  return (
    <section>
      <h2 className="text-lg font-semibold text-white mb-3">
        Okul Başvuruları
        {yeni > 0 && <span className="ml-2 text-xs font-medium bg-violet-600 text-white px-2 py-0.5 rounded-full">{yeni} yeni</span>}
      </h2>
      {!items?.length ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-slate-500">Henüz başvuru yok.</div>
      ) : (
        <div className="space-y-2">
          {items.map(b => (
            <div key={b.id} className="bg-slate-900 border border-slate-800 rounded-xl px-5 py-3 flex flex-wrap items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-white">{b.school_name}</p>
                <p className="text-sm text-slate-300">
                  {b.contact_name} · <a href={`mailto:${b.email}`} className="text-violet-300 hover:underline">{b.email}</a>
                  {b.phone && <> · <a href={`tel:${b.phone}`} className="text-violet-300 hover:underline">{b.phone}</a></>}
                </p>
                {b.note && <p className="text-sm text-slate-400 mt-1 whitespace-pre-wrap">{b.note}</p>}
                <p className="text-xs text-slate-500 mt-1">{new Date(b.created_at).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })}</p>
              </div>
              <BasvuruDurum id={b.id} durum={b.durum} />
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
