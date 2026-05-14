import { createClient } from '@supabase/supabase-js'

// Sadece server-side server components/actions içinde kullan.
// Client bundle'a sızmaz — NEXT_PUBLIC_ prefix'i yok.
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase service role env vars eksik')
  return createClient(url, key, { auth: { persistSession: false } })
}
