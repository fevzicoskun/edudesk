/** Öğretmen aktifliği — kaynak usage_daily (uygulamayı açtığı günler). MY/müdür ana sayfası ve
 *  Kullanıcılar sayfası aynı kuralı kullanır (2026-09-29; önceki kaynak user_sessions haziranda ölmüştü). */
export const AKTIF_GUN = 14

/** YYYY-MM-DD'den n gün önce. UTC öğlen üzerinden hesaplanır — saat dilimi/yaz saati kaydırmaz. */
export function gunOnce(gun: string, n: number): string {
  const d = new Date(`${gun}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString().slice(0, 10)
}

/** Son AKTIF_GUN gün (bugün dahil) içinde kullanım varsa aktif. bugun = İstanbul günü (todayLocalISO). */
export function aktifMi(sonGun: string | null | undefined, bugun: string): boolean {
  return !!sonGun && sonGun >= gunOnce(bugun, AKTIF_GUN - 1)
}
