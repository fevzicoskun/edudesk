// Abonelik durum matematiği — saf, DB'siz. Spec: docs/superpowers/specs/2026-07-09-abonelik-design.md
// access_until DAHİL son erişim günüdür; null = süresiz (geriye uyumluluk).

export type SubscriptionState = 'suspended' | 'expired' | 'expiring' | 'active'

export const UYARI_ESIGI_GUN = 14

const GUN_MS = 86_400_000

/** access_until − today, gün cinsinden. İkisi de 'YYYY-MM-DD' (UTC parse — aynı format, fark güvenli). */
export function kalanGun(accessUntil: string, today: string): number {
  return Math.round((Date.parse(accessUntil) - Date.parse(today)) / GUN_MS)
}

export function subscriptionState(
  s: { status: string; access_until: string | null },
  today: string,
): SubscriptionState {
  if (s.status === 'suspended' || s.status === 'cancelled') return 'suspended'
  if (!s.access_until) return 'active'
  const gun = kalanGun(s.access_until, today)
  if (gun < 0) return 'expired'
  if (gun <= UYARI_ESIGI_GUN) return 'expiring'
  return 'active'
}
