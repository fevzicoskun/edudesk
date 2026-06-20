# Profil Fotoğrafı (Avatar) — Tasarım

**Tarih:** 2026-06-20
**Durum:** Onaylandı (public bucket)

## Amaç
Kullanıcılar profil fotoğrafı yükleyebilsin. Foto yoksa mevcut baş-harf avatarı gösterilir.
Baş-harf avatarı (commit dca6b04) bu işin temeli; bu iş onun üstüne foto katmanı ekler.

## Kararlar
- **Bucket:** yeni **public** `avatars` bucket'ı. Yol deseni: `{userId}/{timestamp}.webp`.
  - Storage RLS: `authenticated` yalnız kendi `{userId}/` klasörüne insert/update/delete; okuma public.
  - Gerekçe: avatar `<img>`'de gösterilecek; public standart, imzalı-URL karmaşıklığı gereksiz. `schedule-files` zaten public precedent.
- **DB:** `profiles.avatar_url text` (nullable). null = foto yok → baş-harf fallback.
- **Görüntü işleme:** tarayıcıda canvas ile **256×256 kare**ye küçült, `image/webp` (~0.85). Dev dosya sunucuya gitmez, depolama küçük kalır.
- **Limit:** `accept="image/*"`, küçültme öncesi ~5MB sınır.

## Bileşenler
1. **Migration** (`*_avatar.sql`): `profiles.avatar_url` kolonu + `avatars` bucket + storage.objects RLS politikaları (owner-folder write, public read).
2. **`resizeImage` saf util** (`src/shared/image/resizeImage.ts`): File/Blob → kare webp Blob. Tarayıcı API'leri (canvas) — test edilebilir bölüm = boyut/oran matematiği ayrı saf fonksiyon (`computeSquareCrop`).
3. **`Avatar` bileşeni genişletme:** opsiyonel `src?: string | null`. Varsa `<img object-cover rounded-full>`, yoksa mevcut baş-harf. Tek değişiklik noktası.
4. **`AvatarUpload` client bileşeni** (`/profil`): avatara tıkla → seç → küçült → upload → `updateAvatar(url)`. "Kaldır" → `removeAvatar()`.
5. **Server action'lar** (`app/actions/avatar.ts`): `updateAvatar(url)` (kendi profilini günceller), `removeAvatar()` (url=null + storage'dan sil). RBAC: yalnız kendi profili.
6. **Veri akışı:** `getCurrentProfile` select'ine `avatar_url` eklenir; `SidebarProfile` tipine `avatar_url` eklenir; layout → Sidebar → Avatar; `/profil` → AvatarUpload.

## Akış
```
[/profil] avatara tıkla → dosya seç → resizeImage (256² webp)
   → supabase.storage.from('avatars').upload(`${uid}/${ts}.webp`)
   → getPublicUrl → updateAvatar(url) → revalidate
Sidebar/header/profil: Avatar src={profile.avatar_url} (yoksa baş-harf)
```

## Hata yönetimi
- Upload hatası → kullanıcıya görünür mesaj (sessiz yutma yok), baş-harf'e düşmez (eski foto kalır).
- Geçersiz dosya tipi/boyut → seçim anında uyarı.
- `removeAvatar` storage silme hatası → log + yine de url=null (kullanıcı foto'yu kaldırabilsin; öksüz dosya tolere edilir).

## Test
- `computeSquareCrop` saf matematik (yatay/dikey/kare girdiler → doğru crop kutusu).
- `updateAvatar`/`removeAvatar` action doğrulama (kendi profili, geçersiz url reddi).

## Kapsam dışı (YAGNI)
- Kırpma/zoom editörü (otomatik merkez-kare yeter).
- Çoklu boyut/CDN dönüşümü.
- Öğrenci/veli avatarları (yalnız kullanıcı profilleri).
