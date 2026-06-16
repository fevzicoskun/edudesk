// Özürsüz devamsızlık (absent×1 + late×0.5) için MEB uyarı ve sınır eşikleri
export const ATTENDANCE_WARN_DAYS  = 15  // uyarı — özürsüz 15 güne ulaştı
export const ATTENDANCE_LIMIT_DAYS = 20  // tehlike — sınıf tekrarı riski

// Öğretmenin yoklama düzenleyebildiği son saat (Türkiye saati)
// Bu saatten sonra yalnızca müdür yardımcısı/müdür/admin düzenleyebilir
export const YOKLAMA_LOCK_HOUR   = 10
export const YOKLAMA_LOCK_MINUTE = 30

// Verilen ana göre (TR saati) öğretmenin bugünün yoklamasını düzenleme penceresi kapandı mı?
// Tek kaynak: hem yoklama ekranı hem dashboard CTA bunu kullanır (drift olmasın diye).
export function isYoklamaTimeLocked(now: Date): boolean {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(now)
  const h = parseInt(parts.find(p => p.type === 'hour')!.value) % 24
  const m = parseInt(parts.find(p => p.type === 'minute')!.value)
  return h > YOKLAMA_LOCK_HOUR || (h === YOKLAMA_LOCK_HOUR && m >= YOKLAMA_LOCK_MINUTE)
}
