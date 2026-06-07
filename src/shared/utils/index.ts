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
