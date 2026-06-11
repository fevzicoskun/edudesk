// Özürsüz devamsızlık (absent×1 + late×0.5) için MEB uyarı ve sınır eşikleri
export const ATTENDANCE_WARN_DAYS  = 15  // uyarı — özürsüz 15 güne ulaştı
export const ATTENDANCE_LIMIT_DAYS = 20  // tehlike — sınıf tekrarı riski

// Öğretmenin yoklama düzenleyebildiği son saat (Türkiye saati)
// Bu saatten sonra yalnızca müdür yardımcısı/müdür/admin düzenleyebilir
export const YOKLAMA_LOCK_HOUR   = 10
export const YOKLAMA_LOCK_MINUTE = 30
