import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchAll } from '@/src/shared/utils/fetchAll'
import { YEDEKLENEN_TABLOLAR, yedekSiralama } from './yedekMath'

/** Yedek gövdesi — gece cron'u (Inngest) ve elle yedek (scripts/yedek-al.mts) aynı içeriği üretir.
 *  db: servis client (RLS'siz). Şifre özetleri ALINMAZ; auth'tan yalnız kimlik/e-posta. */
export async function yedekTopla(db: SupabaseClient) {
  const veri: Record<string, unknown[]> = {}
  const basarisiz: string[] = []

  for (const tablo of YEDEKLENEN_TABLOLAR) {
    try {
      // Sayfalı: PostgREST max_rows=1000 tek istekte fazlasını SESSİZCE keser
      veri[tablo] = await fetchAll((from, to) => {
        let q = db.from(tablo).select('*')
        for (const kolon of yedekSiralama(tablo)) q = q.order(kolon)
        return q.range(from, to)
      })
    } catch {
      // Tek tablonun hatası yedeği tümden iptal etmesin; eksik olan raporlanır.
      basarisiz.push(tablo)
    }
  }

  // Giriş hesapları (auth.users) PostgREST'te yok: profiles.id ↔ e-posta eşlemesi kaybolmasın
  try {
    const hesaplar: unknown[] = []
    for (let page = 1; ; page++) {
      const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 })
      if (error) throw error
      hesaplar.push(...data.users.map(u => ({ id: u.id, email: u.email, created_at: u.created_at, user_metadata: u.user_metadata })))
      if (data.users.length < 1000) break
    }
    veri.auth_kullanicilar = hesaplar
  } catch {
    basarisiz.push('auth_kullanicilar')
  }

  const simdi = new Date()
  const satirlar = Object.fromEntries(Object.entries(veri).map(([t, r]) => [t, r.length]))
  return { simdi, basarisiz, satirlar, govde: JSON.stringify({ alindi: simdi.toISOString(), surum: 2, basarisiz, satirlar, veri }) }
}
