import { createClient } from '@/src/infrastructure/supabase/server'
import { getCurrentProfile } from '@/src/shared/auth'

export const SessionRepository = {
  async createSession(userId: string) {
    const supabase = await createClient()
    const profile = await getCurrentProfile()
    return supabase.from('user_sessions').insert({
      user_id: userId,
      school_id: profile?.school_id ?? null,
      login_at: new Date().toISOString(),
      last_seen_at: new Date().toISOString(),
    })
  },

  async updateLastSeen(userId: string) {
    const supabase = await createClient()
    // ORDER/LIMIT are silently ignored on UPDATE in PostgREST — select the row id first
    const { data: session } = await supabase
      .from('user_sessions')
      .select('id')
      .eq('user_id', userId)
      .is('logout_at', null)
      .order('login_at', { ascending: false })
      .limit(1)
      .single()
    if (!session) return
    return supabase
      .from('user_sessions')
      .update({ last_seen_at: new Date().toISOString() })
      .eq('id', session.id)
  },

  async findOpenSession(userId: string) {
    const supabase = await createClient()
    return supabase
      .from('user_sessions')
      .select('id, login_at, last_seen_at')
      .eq('user_id', userId)
      .is('logout_at', null)
      .order('login_at', { ascending: false })
      .limit(1)
      .single()
  },

  async closeSession(sessionId: string, logoutAt: Date, durationMinutes: number) {
    const supabase = await createClient()
    return supabase
      .from('user_sessions')
      .update({
        logout_at: logoutAt.toISOString(),
        duration_minutes: Math.max(durationMinutes, 1),
      })
      .eq('id', sessionId)
  },

  async endSession(userId: string) {
    const { data: session } = await SessionRepository.findOpenSession(userId)
    if (!session) return

    const logoutAt = new Date()
    const loginAt = new Date(session.login_at)
    const durationMinutes = Math.round((logoutAt.getTime() - loginAt.getTime()) / 60000)

    await SessionRepository.closeSession(session.id, logoutAt, durationMinutes)
  },
}
