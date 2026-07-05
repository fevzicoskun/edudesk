// Kullanım metriği izlenen dashboard modülleri.
// app/(dashboard)/ altındaki kök segment'lerle birebir; /platform bilinçli olarak dışarıda.
export const FEATURES = [
  'anasayfa', 'yoklama', 'odevler', 'takvim', 'ders-programi',
  'randevular', 'rapor', 'siniflar', 'kullanicilar', 'nobet',
  'yonetim', 'ayarlar', 'profil',
] as const

export type Feature = (typeof FEATURES)[number]

export function featureFromPath(pathname: string): Feature | null {
  const seg = pathname.split('/')[1] ?? ''
  return (FEATURES as readonly string[]).includes(seg) ? (seg as Feature) : null
}
