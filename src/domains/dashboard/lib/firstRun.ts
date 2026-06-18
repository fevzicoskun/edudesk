export type Role = 'ogretmen' | 'zumre_baskani' | 'mudur_yardimcisi' | 'mudur' | 'admin'

/**
 * Yeni-hesap ilk-kullanım durumu.
 * - 'setup'   → müdür/MY, okulda hiç sınıf yok: kurulum adımları göster
 * - 'waiting' → öğretmen/zümre başkanı/admin, atanmış sınıf yok: pasif bekleme
 * - null      → sınıf var, normal dashboard
 * Not: admin dashboard'da öğretmen rotasına düşer, bu yüzden 'waiting'.
 */
export function firstRunState(role: Role, classCount: number): 'setup' | 'waiting' | null {
  if (classCount > 0) return null
  if (role === 'mudur' || role === 'mudur_yardimcisi') return 'setup'
  return 'waiting'
}
