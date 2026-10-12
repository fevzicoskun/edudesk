// Başlangıç kartı: saf adım/görünürlük mantığı (DB'siz, test edilebilir).

export const ONBOARDING_WINDOW_DAYS = 30

// Profil ilk 30 gün içinde mi? Bozuk tarih → false (kart kritik yol değil).
export function isWithinOnboardingWindow(createdAt: string, now: Date = new Date()): boolean {
  const created = new Date(createdAt).getTime()
  if (Number.isNaN(created)) return false
  return now.getTime() - created <= ONBOARDING_WINDOW_DAYS * 86_400_000
}
