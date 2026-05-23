'use server'

import { SessionService } from '@/src/domains/sessions/services/SessionService'

export async function startSession() {
  return SessionService.startSession()
}

export async function heartbeat() {
  return SessionService.heartbeat()
}

export async function endSession() {
  return SessionService.endSession()
}
