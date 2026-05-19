import 'server-only'
import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/src/infrastructure/supabase/service'

export async function requirePlatformAdmin(req: NextRequest): Promise<string | null> {
  const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '').trim()
  if (!token) return null

  const url     = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  if (!url || !anonKey) return null

  // Use anon client + user JWT to verify identity — service role client behaves
  // differently with user JWTs and should not be used for getUser()
  const anonClient = createClient(url, anonKey, { auth: { persistSession: false } })
  const { data: { user }, error } = await anonClient.auth.getUser(token)
  if (error || !user) return null

  // Service role for cross-tenant platform_admins lookup
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('platform_admins')
    .select('id')
    .eq('id', user.id)
    .maybeSingle()

  return data ? user.id : null
}
