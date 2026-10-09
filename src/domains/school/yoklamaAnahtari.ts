// Yoklama anahtarı (schools.yoklama_aktif) — zamanlanmış işler için yardımcılar.
// Spec: docs/superpowers/specs/2026-10-10-yoklama-anahtari-design.md
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/src/infrastructure/supabase/database.types'

/** Yoklama modülü kapalı okulların satırlarını ayıklar; okulu belirsiz satır da atlanır. */
export function yoklamasiAcik<T extends { school_id: string | null }>(satirlar: T[], kapali: Set<string>): T[] {
  return satirlar.filter(s => s.school_id !== null && !kapali.has(s.school_id))
}

/** Yoklaması kapalı okulların id'leri (servis istemcisiyle). Okuma hatası = throw: hatırlatma işi yeniden denensin,
 *  kapalı okula yanlışlıkla bildirim gitmesin. */
export async function kapaliOkullar(db: SupabaseClient<Database>): Promise<Set<string>> {
  const { data, error } = await db.from('schools').select('id').eq('yoklama_aktif', false)
  if (error) throw new Error(`Yoklama ayarları okunamadı: ${error.message}`)
  return new Set((data ?? []).map(s => s.id))
}
