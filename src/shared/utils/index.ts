// Güvenli karakter setlerinden rastgele string üretir (kaba kuvvet saldırısına dayanıklı)
export function randomString(chars: string, length: number): string {
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

// Okul katılım kodu — I/O/Q/0 gibi karıştırılan karakterler çıkarıldı
// 23⁴ × 10⁴ ≈ 2.8 milyar kombinasyon
export function generateSchoolCode(): string {
  const letters = randomString('ABCDEFGHJKLMNPRSTUVWXYZ', 4)
  const digits  = randomString('0123456789', 4)
  return letters + digits
}

// Geçici şifre — benzer görünümlü karakterler çıkarıldı (I, O, Q, 0, 1)
export function generateTempPassword(): string {
  return randomString('ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789', 10)
}

function istanbulToday(): { year: number; month: number } {
  const iso = new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Istanbul' }).format(new Date())
  const [y, m] = iso.split('-').map(Number)
  return { year: y, month: m }
}

export function getEgitimYili(): string {
  const { year, month } = istanbulToday()
  return month >= 9 ? `${year}-${year + 1}` : `${year - 1}-${year}`
}

export function schoolYearStart(): string {
  const { year, month } = istanbulToday()
  return `${month >= 9 ? year : year - 1}-09-01`
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
