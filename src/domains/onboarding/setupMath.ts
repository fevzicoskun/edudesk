// Başlangıç kartı: saf adım/görünürlük mantığı (DB'siz, test edilebilir).

export interface SetupStep {
  key: string
  title: string
  href: string
  done: boolean
}

export const ONBOARDING_WINDOW_DAYS = 30

// Profil ilk 30 gün içinde mi? Bozuk tarih → false (kart kritik yol değil).
export function isWithinOnboardingWindow(createdAt: string, now: Date = new Date()): boolean {
  const created = new Date(createdAt).getTime()
  if (Number.isNaN(created)) return false
  return now.getTime() - created <= ONBOARDING_WINDOW_DAYS * 86_400_000
}

// Öğretmen adımları. Not: 1. adım kart göründüğünde daima ✓ olur
// (0 sınıflı öğretmen BeklemeWidget görür, kart render edilmez) — ilerleme hissi.
export function buildTeacherSteps(c: {
  classes: number
  schedule: number
  attendance: number
  homework: number
}): SetupStep[] {
  return [
    { key: 'classes',    title: 'Sınıfların atandı',    href: '/siniflar',      done: c.classes > 0 },
    { key: 'schedule',   title: 'Ders programını gir',  href: '/ders-programi', done: c.schedule > 0 },
    { key: 'attendance', title: 'İlk yoklamanı al',     href: '/yoklama',       done: c.attendance > 0 },
    { key: 'homework',   title: 'İlk ödevini ver',      href: '/odevler/yeni',  done: c.homework > 0 },
  ]
}

export function hasIncompleteStep(steps: SetupStep[]): boolean {
  return steps.some(s => !s.done)
}
