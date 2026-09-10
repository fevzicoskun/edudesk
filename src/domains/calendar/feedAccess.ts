// Takvim aboneliği erişim kararı — saf, DB/IO yok.
// İmza doğrulaması (verifyPublicToken) bundan ÖNCE yapılır; burada iptal/okul/abonelik kararı verilir.

import { isMudurOrAbove } from '@/src/shared/types'
import { subscriptionState } from '@/src/domains/billing/subscriptionMath'

export interface FeedScope {
  userId: string
  schoolId: string
  canManage: boolean
}

export interface FeedAccessInput {
  payload: { id: string; jti: string; m?: Record<string, string> }
  /** auth.users.app_metadata.ics_key — "Bağlantıyı yenile" ile değişir; eşleşmeyen token iptal sayılır. */
  storedKey: string | null | undefined
  profile: {
    school_id: string | null
    role: string
    schools: { status: string; access_until: string | null } | null
  } | null
  today: string
}

export type FeedAccessResult =
  | { ok: true; scope: FeedScope }
  | { ok: false; reason: 'not_found' | 'locked' }

const NOT_FOUND: FeedAccessResult = { ok: false, reason: 'not_found' }

export function evaluateFeedAccess({ payload, storedKey, profile, today }: FeedAccessInput): FeedAccessResult {
  if (!storedKey || storedKey !== payload.jti) return NOT_FOUND

  const tokenSchoolId = payload.m?.school_id
  if (!profile?.school_id || !tokenSchoolId || profile.school_id !== tokenSchoolId) return NOT_FOUND

  // Abonelik kilidi: dashboard layout'u ile aynı kural. Okul satırı okunamazsa fail-open (layout deseni).
  if (profile.schools) {
    const state = subscriptionState(profile.schools, today)
    if (state === 'expired' || state === 'suspended') return { ok: false, reason: 'locked' }
  }

  return {
    ok: true,
    scope: { userId: payload.id, schoolId: profile.school_id, canManage: isMudurOrAbove(profile.role) },
  }
}
