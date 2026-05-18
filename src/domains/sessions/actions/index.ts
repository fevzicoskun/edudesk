'use server'

import { SessionService } from '../services/SessionService'

export async function startSession() {
  return SessionService.startSession()
}

export async function heartbeat() {
  return SessionService.heartbeat()
}

export async function endSession() {
  return SessionService.endSession()
}
