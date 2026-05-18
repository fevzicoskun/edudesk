import { SessionRepository } from '../repositories/SessionRepository'
import { createClient } from '@/src/infrastructure/supabase/server'

export const SessionService = {
  async startSession() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await SessionRepository.createSession(user.id)
  },

  async heartbeat() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await SessionRepository.updateLastSeen(user.id)
  },

  async endSession() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await SessionRepository.endSession(user.id)
  },
}
