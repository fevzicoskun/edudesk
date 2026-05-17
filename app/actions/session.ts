'use server'

import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile } from '@/lib/auth'

export async function startSession() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const profile = await getCurrentProfile()
  await supabase.from('user_sessions').insert({
    user_id: user.id,
    school_id: profile?.school_id ?? null,
    login_at: new Date().toISOString(),
    last_seen_at: new Date().toISOString(),
  })
}

export async function heartbeat() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  // En son açık oturumu güncelle
  await supabase
    .from('user_sessions')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .is('logout_at', null)
    .order('login_at', { ascending: false })
    .limit(1)
}

export async function endSession() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const { data: session } = await supabase
    .from('user_sessions')
    .select('id, login_at, last_seen_at')
    .eq('user_id', user.id)
    .is('logout_at', null)
    .order('login_at', { ascending: false })
    .limit(1)
    .single()

  if (!session) return

  const logoutAt = new Date()
  const loginAt = new Date(session.login_at)
  const durationMinutes = Math.round((logoutAt.getTime() - loginAt.getTime()) / 60000)

  await supabase
    .from('user_sessions')
    .update({
      logout_at: logoutAt.toISOString(),
      duration_minutes: Math.max(durationMinutes, 1),
    })
    .eq('id', session.id)
}
