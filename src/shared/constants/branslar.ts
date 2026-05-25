// Lise (9-12) branşları
export const BRANS_LISTESI = [
  'Türk Dili ve Edebiyatı',
  'Matematik',
  'Fizik',
  'Kimya',
  'Biyoloji',
  'Tarih',
  'Coğrafya',
  'Felsefe',
  'Din Kültürü ve Ahlak Bilgisi',
  'İngilizce',
  'Almanca',
  'Beden Eğitimi ve Spor',
  'Müzik',
  'Görsel Sanatlar',
  'Bilişim Teknolojileri',
  'PDR',
  'Diğer',
] as const

export type Brans = typeof BRANS_LISTESI[number]
