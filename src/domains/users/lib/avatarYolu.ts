/** Profil fotoğrafı URL'sinden silinecek depolama yolunu çıkarır — YALNIZ kullanıcının kendi klasöründeyse.
 *  avatar_url kullanıcının kendi yazabildiği bir alan; silme RLS'i atlayan servis anahtarıyla yapıldığı için
 *  başkasının dosyasını gösteren URL'ye null döner (2026-10-03). */
export function avatarYolu(url: string | null | undefined, userId: string): string | null {
  if (!url) return null
  const yol = decodeURIComponent(url.split('/avatars/')[1]?.split('?')[0] ?? '')
  return yol.startsWith(`${userId}/`) && !yol.includes('..') ? yol : null
}
