# EduDesk — Zümre Takip Sistemi

Türk ortaöğretim öğretmenleri için Next.js + Supabase tabanlı, production-grade zümre yönetim platformu.

**Canlı:** https://zumre-takip.vercel.app

---

## Özellikler

| Modül | Ne yapıyor |
|-------|-----------|
| **Sınıf & Öğrenci** | Toplu ekleme, sınıf bazlı liste, öğrenci notları, Excel export |
| **Ödev Takibi** | Durum board, notlar, toplu güncelleme, Excel export, mobil swipe sil |
| **Yoklama** | Günlük devam takibi, yıllık devamsızlık istatistikleri, yazdırma linki |
| **Veli Portalı** | HMAC-imzalı link ile salt okunur öğrenci özeti (ödev + devamsızlık + notlar) |
| **Zümre Toplantıları** | Gündem oluşturma, tutanak yazdırma *(sadece Zümre Başkanı)* |
| **Ortak Sınavlar** | Sınav planlaması, öğrenci bazlı not girişi *(sadece Zümre Başkanı)* |
| **Müfredat Takibi** | TYMM import, konu bazlı ilerleme |
| **Excel / PDF Export** | Gerçek XLSX (SheetJS), server-side Supabase Storage; client-side jspdf |
| **Raporlar** | Öğrenci, sınıf ve öğretmen bazlı interaktif grafikler (Recharts) + Excel/PDF export |
| **Mentor Sistemi** | Müdür yardımcısı sınıfa mentör atar; mentör öğrenciye tarihli rapor girer |
| **Müdür Y. Dashboard** | Yaklaşan ödevler + devamsızlık özeti — 14 günlük takvim-ajanda widget'ı |
| **Denetim Günlüğü** | Tüm işlemler kaydedilir; token iptali *(sadece Zümre Başkanı)* |
| **Öğretmen Dosyası** | MEB belge kontrol listesi, PDF export |
| **Kişisel Notlar** | Zengin metin editörü, Excel export |
| **Dark Mode** | Sistem teması veya manuel geçiş |

---

## Rol Sistemi

| Özellik | Öğretmen | Zümre Başkanı | Müdür Yardımcısı | Müdür |
|---------|----------|---------------|------------------|-------|
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
| Raporlar modülü | ✅ | ✅ | ✅ | ✅ |
| Kullanıcı listesi (tüm roller) | ❌ | ❌ | ✅ (müdür hariç) | ✅ |

### Rol atama (SQL)

```sql
-- Kullanıcı UUID'sini bul
SELECT id, email FROM auth.users WHERE email = 'ornek@okul.com';

-- Rol ata
UPDATE profiles
SET role = 'zumre_baskani'   -- veya: ogretmen | mudur_yardimcisi | mudur
WHERE id = '<kullanıcı-uuid>';
```

### Yeni öğretmen ekleme

Öğretmen `/login` → **Kayıt Ol** ile hesap oluşturur, `/onboarding` sayfasına yönlendirilir. Mevcut bir okula katılım için:

```sql
-- Okul UUID'sini öğren
SELECT id, name FROM schools;

-- Öğretmeni okula ata
UPDATE profiles
SET school_id = '<okul-uuid>'
WHERE id = '<öğretmen-uuid>';
```

---

## Kurulum (Yeni Proje)

### Gereksinimler

- Node.js 20+
- Supabase hesabı (ücretsiz plan yeterli)
- Upstash hesabı (rate limiting — opsiyonel, yoksa in-memory fallback çalışır)

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

| Değişken | Nereden alınır | Zorunlu |
|----------|---------------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API → Project URL | ✅ |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase → Settings → API → `anon` public key | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → `service_role` secret key | ✅ |
| `TOKEN_SECRET` | `openssl rand -hex 32` | ✅ |
| `UPSTASH_REDIS_REST_URL` | [console.upstash.com](https://console.upstash.com) → Redis → REST URL | opsiyonel |
| `UPSTASH_REDIS_REST_TOKEN` | Aynı sayfadan REST Token | opsiyonel |

> **`SUPABASE_SERVICE_ROLE_KEY` kritik:** Veli portalı, yoklama yazdırma ve admin işlemleri bu key olmadan 500 hatası verir.

### 3. Veritabanını kur

Supabase Dashboard → **SQL Editor** — migration dosyalarını sırasıyla çalıştır:

```
supabase/migrations/
  ├── 20260513165225_create_attendance_table.sql
  ├── 20260513170429_add_grade_map_drop_orphaned_tables.sql
  ├── 20260514173535_rol_bazli_rls_politikalari.sql
  ├── 20260514205010_audit_log_sistemi.sql
  ├── 20260514205140_multi_tenant_school_isolation.sql
  ├── 20260514211517_schools_isolation_20260515.sql
  ├── 20260514211611_rls_hardening_20260515.sql
  ├── 20260515_phase3_constraints_jobs_revocation.sql
  ├── 20260519100000_add_mentor_teacher.sql
  └── 20260519110000_add_mentor_reports.sql
```

### 4. Supabase Storage bucket oluştur

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

```bash
npx vercel link
npx vercel env add NEXT_PUBLIC_SUPABASE_URL production
npx vercel env add NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY production
npx vercel env add SUPABASE_SERVICE_ROLE_KEY production
npx vercel env add TOKEN_SECRET production
npx vercel env add UPSTASH_REDIS_REST_URL production
npx vercel env add UPSTASH_REDIS_REST_TOKEN production
npx vercel --prod
```

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
| Grafikler | Recharts (ResponsiveContainer) |
| Veritabanı | Supabase (PostgreSQL 17 + RLS) |
| Auth | Supabase SSR (`@supabase/ssr`) |
| Rate Limiting | Upstash Redis (`@upstash/ratelimit`) |
| Storage | Supabase Storage (private bucket) |
| Excel | SheetJS (`xlsx`) |
| PDF | jspdf + jspdf-autotable |
| Mobil UX | react-swipeable |
| Tarih | date-fns v4 (tr locale) |
| Dil | TypeScript 5 |
| Deploy | Vercel |

---

## Proje Yapısı

```
app/
├── (dashboard)/
│   ├── anasayfa/        # Dashboard — Müdür ajanda widget, MüdürY ajanda widget
│   ├── audit/           # Denetim günlüğü + token iptali (başkan/müdür)
│   ├── dosya/           # MEB belge kontrol listesi + PDF export
│   ├── kullanicilar/    # Kullanıcı listesi (müdür yardımcısı/müdür)
│   ├── mufredat/        # Müfredat takibi
│   ├── notlar/          # Kişisel notlar + Excel export
│   ├── odevler/         # Ödev yönetimi + swipe-to-delete (mobil)
│   ├── profil/          # Profil & şifre
│   ├── raporlar/        # Raporlar (Öğrenci / Sınıf / Öğretmen) + export
│   ├── siniflar/        # Sınıf & öğrenci + mentor atama + Excel export
│   ├── yoklama/         # Günlük yoklama
│   └── zumre/           # Toplantı, sınav, müfredat (başkan özellikleri)
├── api/
│   └── export/          # POST: XLSX üret → Storage; GET: iş durumu
├── onboarding/
├── veli/[token]/
├── yoklama-yazdir/[token]/
├── tutanak/[id]/
└── actions/
    ├── auth.ts
    ├── classes.ts       # assignMentor, addMentorReport, deleteMentorReport
    ├── homework.ts
    ├── yoklama.ts
    ├── zumre.ts
    ├── tokens.ts
    ├── onboarding.ts
    └── notes.ts

src/
├── domains/export/      # XlsxBuilder, export types
└── shared/
    ├── auth/            # getCurrentProfile
    ├── date/            # formatDate, startOfWeek
    └── types/           # Role, Database types

supabase/migrations/     # Sıralı SQL migration dosyaları
proxy.ts                 # Middleware: auth + rate limit + CSP nonce + onboarding redirect
```
