// Push teşvik şeridi: saf snooze mantığı (DB'siz, tarayıcı-API'siz, test edilebilir).
// Spec: docs/superpowers/specs/2026-07-04-push-tesvik-seridi-design.md

export const NUDGE_SNOOZE_DAYS = 14
export const NUDGE_STORAGE_KEY = 'edudesk-push-nudge-dismissed-at'

// "Daha sonra" damgasına göre şerit gösterilsin mi? Bozuk/eksik damga → göster (fail-open).
export function shouldShowPushNudge(dismissedAtISO: string | null, now: Date = new Date()): boolean {
  if (!dismissedAtISO) return true
  const dismissed = new Date(dismissedAtISO).getTime()
  if (Number.isNaN(dismissed)) return true
  return now.getTime() - dismissed >= NUDGE_SNOOZE_DAYS * 86_400_000
}
