# EduDesk — Zümre Takip Sistemi

Türk ortaöğretim öğretmenleri için Next.js + Supabase tabanlı, production-grade zümre yönetim platformu.

**Canlı:** https://zumre-takip.vercel.app

---

## Özellikler

| Modül | Ne yapıyor |
|-------|-----------|
| **Sınıf & Öğrenci** | Toplu ekleme, sınıf bazlı liste, öğrenci notları |
| **Ödev Takibi** | Durum board, notlar, toplu güncelleme, Excel export |
| **Yoklama** | Günlük devam takibi, yıllık devamsızlık istatistikleri, yazdırma linki |
| **Veli Portalı** | HMAC-imzalı link ile salt okunur öğrenci özeti (ödev + devamsızlık + notlar) |
| **Zümre Toplantıları** | Gündem oluşturma, tutanak yazdırma *(sadece Zümre Başkanı)* |
| **Ortak Sınavlar** | Sınav planlaması, öğrenci bazlı not girişi *(sadece Zümre Başkanı)* |
| **Müfredat Takibi** | TYMM import, konu bazlı ilerleme |
| **Excel Export** | Gerçek XLSX (SheetJS), Supabase Storage'a yükler, 1 saatlik indirme linki |
| **Denetim Günlüğü** | Tüm işlemler kaydedilir; token iptali *(sadece Zümre Başkanı)* |
| **Öğretmen Dosyası** | MEB belge kontrol listesi |
| **Kişisel Notlar** | Zengin metin editörü |
| **Dark Mode** | Sistem teması veya manuel geçiş |

---

## Rol Sistemi

### Roller

| Özellik | Öğretmen | Zümre Başkanı |
|---------|----------|---------------|
| Kendi ödevlerini yönetme | ✅ | ✅ |
| Tüm ödevleri görme | ❌ | ✅ |
| Yoklama alma | ✅ | ✅ |
| Sınıf oluşturma / silme | ❌ | ✅ |
| Öğrenci ekleme | ✅ | ✅ |
| Zümre toplantısı oluşturma | ❌ | ✅ |
| Ortak sınav oluşturma | ❌ | ✅ |
| Müfredat takibi | ✅ (kendi) | ✅ (tümü) |
| Denetim günlüğü görme | ❌ | ✅ |
| Token iptal etme | ❌ | ✅ |

### Zümre Başkanı nasıl atanır?

> **Supabase Dashboard → Table Editor → `profiles` tablosu**

1. Dashboard'a gir: [supabase.com/dashboard](https://supabase.com/dashboard) → Projen → **Table Editor**
2. Sol menüden `profiles` tablosuna tıkla
3. Atamak istediğin kullanıcının satırını bul (e-posta veya `full_name` ile)
4. `role` sütununu çift tıkla → `zumre_baskani` yaz → **Save**

Alternatif — SQL Editor ile:
```sql
UPDATE profiles
SET role = 'zumre_baskani'
WHERE id = '<kullanıcı-uuid>';
```

Kullanıcının UUID'sini bulmak için:
```sql
SELECT id, email FROM auth.users WHERE email = 'ornek@okul.com';
```

### Yeni öğretmen nasıl eklenir?

EduDesk'e davet sistemi yoktur. Yeni öğretmen şu adımları izler:

1. `/login` sayfasından **"Kayıt Ol"** ile hesap oluşturur *(Supabase email doğrulaması gerekir)*
2. Giriş yaptıktan sonra `/onboarding` sayfasına yönlendirilir
3. **Varolan okulu girmek yerine** Zümre Başkanı, o kullanıcının `profiles.school_id` alanını kendi okulunun UUID'siyle günceller:

```sql
-- Önce okul UUID'ni öğren
SELECT id, name FROM schools;

-- Sonra öğretmeni o okula ata
UPDATE profiles
SET school_id = '<okul-uuid>'
WHERE id = '<öğretmen-uuid>';
```

> Onboarding sayfası yeni okul oluşturur. Mevcut bir okula katılım için yukarıdaki SQL gerekir.

---

## Kurulum (Yeni Proje)

### Gereksinimler

- Node.js 20+
- Supabase hesabı (ücretsiz plan yeterli)
- Upstash hesabı (rate limiting için — opsiyonel, yoksa in-memory fallback çalışır)

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

`.env.local` dosyasını doldur:

| Değişken | Nereden alınır |
|----------|---------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase → Settings → API → `anon` public key |
| `TOKEN_SECRET` | `openssl rand -hex 32` komutuyla üret |
| `UPSTASH_REDIS_REST_URL` | [console.upstash.com](https://console.upstash.com) → Redis DB → REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | Aynı sayfadan REST Token |

### 3. Veritabanını kur

Supabase Dashboard → **SQL Editor**'de aşağıdaki migration dosyalarını **sırasıyla** çalıştır:

```
supabase/migrations/
  ├── 20260513165225_create_attendance_table.sql
  ├── 20260513170429_add_grade_map_drop_orphaned_tables.sql
  ├── 20260514173535_rol_bazli_rls_politikalari.sql
  ├── 20260514205010_audit_log_sistemi.sql
  ├── 20260514205140_multi_tenant_school_isolation.sql
  ├── 20260514211517_schools_isolation_20260515.sql
  ├── 20260514211611_rls_hardening_20260515.sql
  └── 20260515_phase3_constraints_jobs_revocation.sql
```

> Her dosyanın içeriğini SQL Editor'e yapıştır → **Run** → Hata yoksa sonrakine geç.

### 4. Supabase Storage bucket oluştur

SQL Editor'de:

```sql
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'exports', 'exports', false, 10485760,
  ARRAY['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "exports_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'exports' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "exports_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'exports' AND (storage.foldername(name))[1] = auth.uid()::text);
```

### 5. Geliştirme sunucusu

```bash
npm run dev
```

`http://localhost:3000` adresinde açılır.

---

## Deploy (Vercel)

### İlk deploy

```bash
npx vercel link          # projeyi bağla
npx vercel env add NEXT_PUBLIC_SUPABASE_URL production
npx vercel env add NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY production
npx vercel env add TOKEN_SECRET production
npx vercel env add UPSTASH_REDIS_REST_URL production
npx vercel env add UPSTASH_REDIS_REST_TOKEN production
npx vercel --prod
```

### Sonraki pushlar

`main` branch'ine push atınca Vercel otomatik deploy eder.

---

## Güvenlik

| Önlem | Uygulama |
|-------|---------|
| Kimlik doğrulama | Supabase JWT, secure httpOnly cookies |
| Çok kiracılı izolasyon | `school_id NOT NULL` + RLS her tabloda |
| Public route güvenliği | HMAC-SHA256 imzalı token (jti + exp) |
| Token iptali | `revoked_tokens` tablosu, anında etkili |
| Rate limiting | Upstash Redis sliding window (10/60 req/dk) |
| CSP | Per-request nonce — `unsafe-inline` yok |
| Input doğrulama | Zod tüm server action'larda |
| Denetim kaydı | Her kritik işlem `audit_logs`'a yazılır |

---

## Teknik Yığın

| Katman | Teknoloji |
|--------|-----------|
| Framework | Next.js 16 (App Router, Server Actions) |
| UI | React 19, Tailwind CSS v4 |
| Veritabanı | Supabase (PostgreSQL 17 + RLS) |
| Auth | Supabase SSR (`@supabase/ssr`) |
| Rate Limiting | Upstash Redis (`@upstash/ratelimit`) |
| Storage | Supabase Storage (private bucket) |
| Excel | SheetJS (`xlsx`) |
| Tarih | date-fns v4 (tr locale) |
| Dil | TypeScript 5 |
| Deploy | Vercel |

---

## Proje Yapısı

```
app/
├── (dashboard)/         # Korumalı sayfalar (auth + school_id zorunlu)
│   ├── anasayfa/        # Dashboard
│   ├── audit/           # Denetim günlüğü + token iptali (sadece başkan)
│   ├── dosya/           # MEB belge kontrol listesi
│   ├── mufredat/        # Müfredat takibi
│   ├── notlar/          # Kişisel notlar
│   ├── odevler/         # Ödev yönetimi
│   ├── profil/          # Profil & şifre
│   ├── siniflar/        # Sınıf & öğrenci yönetimi
│   ├── yoklama/         # Günlük yoklama
│   └── zumre/           # Toplantı, sınav, müfredat (başkan özellikleri)
├── api/
│   └── export/          # POST: XLSX üret → Storage; GET: iş durumu
├── onboarding/          # Yeni kullanıcı okul kurulum sayfası
├── veli/[token]/        # Veli portalı (public, HMAC korumalı)
├── yoklama-yazdir/[token]/ # Yoklama yazdırma (public, HMAC korumalı)
├── tutanak/[id]/        # Toplantı tutanağı yazdırma
└── actions/             # Server Actions
    ├── auth.ts
    ├── class.ts          # school_id inject
    ├── homework.ts       # school_id inject
    ├── yoklama.ts        # school_id inject
    ├── zumre.ts          # school_id inject
    ├── tokens.ts         # generateVeliToken, revokeToken
    ├── onboarding.ts     # setupSchool
    └── notes.ts

lib/
├── auth.ts              # getCurrentUser, getCurrentProfile, requireSchoolId
├── audit.ts             # logAudit (fire-and-forget)
├── jobs.ts              # createExportJob, getExportJob
├── public-tokens.ts     # createPublicToken, verifyPublicToken, isTokenRevoked
├── validation.ts        # Zod şemaları
└── supabase/            # server.ts, client.ts

proxy.ts                 # Middleware: auth + rate limit + CSP nonce + onboarding redirect
supabase/migrations/     # Sıralı SQL migration dosyaları
```
