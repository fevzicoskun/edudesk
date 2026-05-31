export function getEgitimYili(): string {
  const now = new Date()
  const ay = now.getMonth() + 1
  const yil = now.getFullYear()
  return ay >= 9 ? `${yil}-${yil + 1}` : `${yil - 1}-${yil}`
}

export function schoolYearStart(): string {
  const now = new Date()
  const year = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1
  return `${year}-09-01`
}

export function getGreeting(fullName: string): string {
  const hour = parseInt(
    new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', hour: 'numeric', hour12: false }).format(new Date()),
    10
  )
  const firstName = (fullName || '').split(' ')[0]
  if (hour < 12) return `Günaydın, ${firstName}`
  if (hour < 18) return `İyi günler, ${firstName}`
  return `İyi akşamlar, ${firstName}`
}
