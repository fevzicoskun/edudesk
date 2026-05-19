# EduDesk — Okul Yönetim Platformu

Türk ortaöğretim öğretmenleri için Next.js + Supabase tabanlı, production-grade okul yönetim platformu.

**Canlı:** https://zumre-takip.vercel.app

---

## Özellikler

| Modül | Açıklama |
|-------|-----------|
| **Sınıf & Öğrenci** | Toplu ekleme, sınıf bazlı liste, öğrenci notları, Excel export |
| **Ödev Takibi** | Durum board, notlar, toplu güncelleme, Excel export, mobil swipe sil |
| **Yoklama** | Günlük devam takibi, yıllık devamsızlık istatistikleri, yazdırma linki |
| **Veli Portalı** | HMAC-imzalı link ile salt okunur öğrenci özeti (ödev + devamsızlık + notlar) |
| **Zümre Toplantıları** | Gündem oluşturma, tutanak yazdırma *(sadece Zümre Başkanı)* |
| **Ortak Sınavlar** | Sınav planlaması, öğrenci bazlı not girişi *(sadece Zümre Başkanı)* |
| **Müfredat Takibi** | TYMM import, konu bazlı ilerleme |
| **Raporlar** | Öğrenci/sınıf/öğretmen/mentor bazlı interaktif grafikler (Recharts) + Excel/PDF export |
| **Mentörlük** | Atanmış sınıf öğrencilerine rapor + kişisel öğrenci takip defteri (veli bilgileri dahil) |
| **Ders Programı** | MY PDF/resim yükler → öğretmenler dashboard'dan görür |
| **Müdür Y. Dashboard** | Devamsızlık özeti, öğretmen listesi, ajanda, mentör rapor özeti |
| **Müdür Dashboard** | Okul geneli istatistikler, ajanda, mentör rapor özeti |
| **Denetim Günlüğü** | Tüm işlemler kaydedilir; token iptali *(Başkan/Müdür)* |
| **Öğretmen Dosyası** | MEB belge kontrol listesi, PDF export |
| **Kişisel Notlar** | Not editörü, Excel export |
| **Dark Mode** | Sistem teması veya manuel geçiş |

---

## Rol Sistemi

### Hiyerarşi

```
Müdür
  └─ Müdür Yardımcısı
       └─ Zümre Başkanı
            └─ Öğretmen
```

Her üst rol, alt rolün tüm yetkilerini içerir.

### Yetki Matrisi

| Özellik | Öğretmen | Zümre Başkanı | Müdür Yardımcısı | Müdür |
|---------|:--------:|:-------------:|:----------------:|:-----:|
| Kendi ödevlerini yönetme | ✅ | ✅ | ✅ | ✅ |
| Tüm ödevleri görme | ❌ | ✅ | ✅ | ✅ |
| Yoklama alma | ✅ | ✅ | ✅ | ✅ |
| Sınıf oluşturma / silme | ❌ | ✅ | ✅ | ✅ |
| Öğrenci ekleme | ✅ | ✅ | ✅ | ✅ |
| Zümre toplantısı oluşturma | ❌ | ✅ | ❌ | ❌ |
| Ortak sınav oluşturma | ❌ | ✅ | ❌ | ❌ |
| Müfredat takibi | ✅ (kendi) | ✅ (tümü) | ✅ (tümü) | ✅ (tümü) |
| Denetim günlüğü görme | ❌ | ✅ | ❌ | ✅ |
| Token iptal etme | ❌ | ✅ | ❌ | ❌ |
| Mentor atama | ❌ | ❌ | ✅ | ✅ |
| Mentör raporu yazma | ✅ (atandıysa) | ✅ (atandıysa) | ❌ (okuma) | ❌ (okuma) |
| Mentörlük defteri (manuel öğrenci) | ✅ | ✅ | ❌ | ❌ |
| Ders programı yükleme | ❌ | ❌ | ✅ | ✅ |
| Ders programı görme | ✅ (kendi) | ✅ (kendi) | ✅ (tümü) | ✅ (tümü) |
| Raporlar → Mentör sekmesi | ❌ | ✅ | ✅ | ✅ |
| Kullanıcı listesi | ❌ | ❌ | ✅ (müdür hariç) | ✅ |
| Kullanıcı davet / silme | ❌ | ❌ | ❌ | ✅ |
| Rol atama | ❌ | ❌ | ❌ | ✅ |
| Silinen kayıtları geri yükleme | ❌ | ❌ | ✅ | ✅ |

### Rol Atama (SQL)

```sql
-- Kullanıcı UUID'sini bul
SELECT id, email FROM auth.users WHERE email = 'ornek@okul.com';

-- Rol ata (ogretmen | zumre_baskani | mudur_yardimcisi | mudur)
UPDATE profiles SET role = 'zumre_baskani' WHERE id = '<uuid>';
```

### Yeni Öğretmen Ekleme

Öğretmen `/login` → **Kayıt Ol** ile hesap oluşturur. Mevcut okula katılım için:

```sql
SELECT id, name FROM schools;
UPDATE profiles SET school_id = '<okul-uuid>' WHERE id = '<öğretmen-uuid>';
```

---

## Kurulum

### Gereksinimler

- Node.js 20+
- Supabase hesabı
- Upstash hesabı (opsiyonel — yoksa in-memory rate limit çalışır)

### 1. Kur

```bash
git clone https://github.com/fevzicoskun/zumre-takip.git
cd zumre-takip
npm install
```

### 2. Ortam Değişkenleri

```bash
cp .env.example .env.local
```

| Değişken | Nereden | Zorunlu |
|----------|---------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API | ✅ |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase → Settings → API (anon key) | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API (service_role) | ✅ |
| `TOKEN_SECRET` | `openssl rand -hex 32` | ✅ |
| `UPSTASH_REDIS_REST_URL` | console.upstash.com | opsiyonel |
| `UPSTASH_REDIS_REST_TOKEN` | console.upstash.com | opsiyonel |

### 3. Veritabanı

Supabase Dashboard → SQL Editor → `supabase/migrations/` içindeki dosyaları sırayla çalıştır.

### 4. Storage Bucket

```sql
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('exports', 'exports', false, 10485760,
  ARRAY['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
ON CONFLICT (id) DO NOTHING;
```

`schedule-files` bucket'ı migration ile otomatik oluşturulur.

### 5. Geliştirme

```bash
npm run dev
```

---

## Deploy (Vercel)

`main` branch'ine push atınca Vercel otomatik deploy eder. Ortam değişkenlerini Vercel dashboard → Settings → Environment Variables'dan ayarla.

---

## Güvenlik

| Önlem | Uygulama |
|-------|---------|
| Kimlik doğrulama | Supabase JWT, secure httpOnly cookies |
| Çok kiracılı izolasyon | `school_id NOT NULL` + RLS her tabloda |
| Public route güvenliği | HMAC-SHA256 imzalı token (jti + exp) |
| Token iptali | `revoked_tokens` tablosu + Redis fail-closed cache |
| Rate limiting | Upstash Redis sliding window |
| CSP | Per-request nonce |
| Input doğrulama | Zod tüm server action'larda |
| Denetim kaydı | `audit_logs` — WORM korumalı |
| Soft delete | 5 tabloda, 30 gün geri yükleme penceresi |

---

## Teknik Yığın

| Katman | Teknoloji |
|--------|-----------|
| Framework | Next.js 16 (App Router, Server Actions) |
| UI | React 19, Tailwind CSS v4 |
| Grafikler | Recharts |
| Veritabanı | Supabase (PostgreSQL 17 + RLS) |
| Auth | Supabase SSR |
| Storage | Supabase Storage |
| Rate Limiting | Upstash Redis |
| Excel | SheetJS (xlsx) |
| PDF | jspdf + jspdf-autotable |
| Background Jobs | Inngest v4 |
| Mobil UX | react-swipeable |
| Tarih | date-fns v4 (tr locale) |
| Loglama | Pino |
| Error Tracking | Sentry |
| Deploy | Vercel |
