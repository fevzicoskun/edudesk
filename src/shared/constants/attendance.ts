// Özürsüz devamsızlık (absent×1 + late×0.5) için MEB uyarı ve sınır eşikleri
export const ATTENDANCE_WARN_DAYS  = 15  // uyarı — özürsüz 15 güne ulaştı
export const ATTENDANCE_LIMIT_DAYS = 20  // tehlike — sınıf tekrarı riski

export type YoklamaKilit = 'open' | 'date_locked'

/**
 * Öğretmen bu günün yoklamasını düzenleyebilir mi?
 *
 * Tek kaynak: yoklama ekranı, dashboard CTA ve saveYoklama server action'ı
 * aynı fonksiyonu kullanır (drift olmasın diye).
 *
 * TARİHÇE — 10:30 saat kilidi 2026-09-19'da kaldırıldı:
 * 2026-06-11'de "10:30 sonrası yalnız müdür yardımcısı" kuralı eklenmişti. Canlı
 * veri kuralın gerçek kullanımı kestiğini gösterdi: kilitten önceki kayıtların
 * %80'i 10:30'dan SONRA girilmişti ve kilit sonrası 3 ay boyunca tek kayıt
 * oluşmadı (sistem 414 hatırlatma gönderdi, %56'sı okundu, yine kayıt yok).
 * Ders anlatan öğretmene 10:00 hatırlatması + 10:30 kilidi 30 dakikalık
 * gerçekçi olmayan bir pencere bırakıyordu.
 *
 * Yeni kural: bugünün yoklaması gün boyu açık; başka gün müdür/MY yetkisinde.
 * Geçmiş kadar GELECEK de kapalı — eskiden UI gelecek tarihe izin veriyor ama
 * sunucu reddediyordu.
 */
export function yoklamaKilitDurumu(
  secilenTarih: string,
  bugunTR: string,
  ayricalikli: boolean,
): YoklamaKilit {
  if (ayricalikli) return 'open'
  return secilenTarih === bugunTR ? 'open' : 'date_locked'
}
