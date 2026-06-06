import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) {
    throw new Error('[EduDesk] NEXT_PUBLIC_SUPABASE_URL veya NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY eksik')
  }
  return createBrowserClient(url, key)
}
