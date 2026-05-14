# EduDesk — Zümre Takip Sistemi

Türk ortaöğretim öğretmenleri için Next.js + Supabase tabanlı zümre yönetim platformu.

## Özellikler

- **Sınıf & Öğrenci Yönetimi** — Toplu öğrenci ekleme, sınıf bazlı listeleme
- **Ödev Takibi** — Durum board, notlar, toplu güncelleme, filtreler, Excel export
- **Yoklama** — Günlük devam takibi, yıllık devamsızlık istatistikleri, Excel export
- **Zümre Toplantıları** — Gündem oluşturma, tutanak yazdırma (Zümre Başkanı)
- **Ortak Sınavlar** — Sınav planlaması, öğrenci bazlı not girişi (Zümre Başkanı)
- **Müfredat Takibi** — TYMM import, konu bazlı ilerleme, durum güncelleme
- **Veli Portalı** — QR/link ile salt okunur öğrenci özeti
- **Öğretmen Dosyası** — MEB belge kontrol listesi
- **Kişisel Notlar** — Zengin metin editörü
- **Rol Sistemi** — Zümre Başkanı / Öğretmen ayrımı (RLS tabanlı)
- **Dark Mode** — Sistem teması veya manuel geçiş

## Kurulum

### Gereksinimler

- Node.js 18+
- Supabase hesabı (ücretsiz plan yeterli)

### 1. Klonla ve bağımlılıkları yükle

```bash
git clone https://github.com/fevzicoskun/zumre-takip.git
cd zumre-takip
npm install
```

### 2. Ortam değişkenlerini ayarla

```bash
cp .env.example .env.local
```

`.env.local` dosyasını Supabase proje ayarlarından doldur:

- **URL**: Supabase Dashboard → Settings → API → Project URL
- **Publishable Key**: Supabase Dashboard → Settings → API → `anon` public key

### 3. Veritabanını kur

Supabase Dashboard → SQL Editor'de sırayla çalıştır:

1. `supabase/schema.sql` — tablo ve trigger'lar
2. `supabase/rls_update.sql` — rol bazlı RLS politikaları

### 4. Geliştirme sunucusunu başlat

```bash
npm run dev
```

Uygulama `http://localhost:3000` adresinde açılır.

## Rol Sistemi

| Özellik | Öğretmen | Zümre Başkanı |
|---|---|---|
| Kendi ödevlerini yönetme | ✅ | ✅ |
| Tüm ödevleri görme | ❌ | ✅ |
| Yoklama alma | ✅ | ✅ |
| Sınıf oluşturma/silme | ❌ | ✅ |
| Zümre toplantısı oluşturma | ❌ | ✅ |
| Ortak sınav oluşturma | ❌ | ✅ |
| Müfredat takibi | ✅ (kendi) | ✅ (tümü) |

**Rol atama:** Supabase Dashboard → Table Editor → `profiles` → `role` alanını `zumre_baskani` yap.

## Deploy (Vercel)

1. Repo'yu Vercel'e import et
2. Ortam değişkenlerini ekle:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
3. Deploy — her `main` push'unda otomatik

## Teknik Yığın

| Katman | Teknoloji |
|---|---|
| Framework | Next.js 16 (App Router, Server Actions) |
| UI | React 19, Tailwind CSS v4 |
| Veritabanı | Supabase (PostgreSQL + RLS) |
| Auth | Supabase SSR (@supabase/ssr) |
| Excel | SheetJS (xlsx 0.18) |
| Tarih | date-fns v4 (tr locale) |
| Dil | TypeScript 5 |
| Deploy | Vercel |

## Proje Yapısı

```
app/
├── (auth)/          # Giriş ekranı
├── (dashboard)/     # Korumalı sayfalar
│   ├── anasayfa/    # Dashboard
│   ├── odevler/     # Ödev yönetimi
│   ├── siniflar/    # Sınıf & öğrenci
│   ├── yoklama/     # Yoklama & devamsızlık
│   ├── zumre/       # Toplantı, sınav, müfredat
│   ├── notlar/      # Kişisel notlar
│   └── profil/
├── actions/         # Server Actions (auth, class, homework, yoklama, zumre)
├── tutanak/         # Tutanak yazdırma (public)
└── veli/            # Veli portalı (public)
components/layout/   # Sidebar, SidebarCalendar
lib/                 # auth, supabase client/server, types, utils
supabase/            # schema.sql, rls_update.sql
```
