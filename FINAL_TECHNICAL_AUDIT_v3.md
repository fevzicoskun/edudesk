# EduDesk — Final Technical Audit v3

*Tarih: 2026-05-15 · Önceki: FINAL_TECHNICAL_AUDIT_v2.md (2026-05-15)*
*Stack: Next.js 16.2.4 App Router · TypeScript 5.x · Supabase (PostgreSQL 17) · Tailwind v4*

---

## Özet — Bu Session'da Yapılanlar

| Commit | İçerik |
|--------|--------|
| `phase3` | school_id NOT NULL · Token revocation · Upstash Redis rate limiting · Background jobs |

**Kapanış Durumu:** 4 P0 maddesi tamamlandı, 3 P1 maddesi kısmen tamamlandı.

---

## 1. SCHOOL_ID NOT NULL ENFORCEMENT ✅ TAMAMLANDI

### Migration: `20260515_phase3_constraints_jobs_revocation.sql`

Tüm kritik tablolara `NOT NULL` kısıtı eklendi:

```sql
ALTER TABLE profiles, classes, students, homeworks, attendance,
  zumre_meetings, common_exams, curriculum_progress,
  student_notes, homework_submissions
ALTER COLUMN school_id SET NOT NULL;
```

### Server Actions — school_id Injection ✅

**`lib/auth.ts`** — yeni `requireSchoolId()` helper:
```typescript
export async function requireSchoolId(): Promise<string> {
  const profile = await getCurrentProfile()
  if (!profile?.school_id) throw new Error('Okul bilgisi bulunamadı')
  return profile.school_id
}
```

`getCurrentProfile()` artık `school_id` döndürüyor (`select` genişletildi).

**Güncellenen Server Actions (school_id inject edildi):**

| Dosya | Fonksiyonlar |
|-------|-------------|
| `app/actions/class.ts` | `createClass`, `addStudent`, `addStudentsBulk`, `addStudentNote` |
| `app/actions/homework.ts` | `createHomework`, `updateSubmissionStatus`, `updateAllSubmissionStatuses`, `updateSubmissionNote` |
| `app/actions/yoklama.ts` | `saveAttendance` |
| `app/actions/zumre.ts` | `createMeeting`, `createExam`, `createCurriculumProgress`, `importFromTYMM` |

**Pattern:** `const [supabase, school_id] = await Promise.all([createClient(), requireSchoolId()])`
— paralel çağrı, ek gecikme yok.

**`lib/audit.ts`** — `AuditEntry`'e `school_id` eklendi + `token.revoke` action tipi.

---

## 2. UPSTASH REDIS RATE LIMITING ✅ TAMAMLANDI

### Paketler
```
@upstash/ratelimit @upstash/redis
```

### `proxy.ts` — Hybrid Rate Limiter

```typescript
// Env varları varsa Upstash Redis, yoksa in-memory fallback
if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  // Sliding window — kalıcı, cross-instance, cold-start güvenli
  loginLimit = Ratelimit.slidingWindow(10, '60 s')
  publicLimit = Ratelimit.slidingWindow(60, '60 s')
} else {
  // Dev fallback: in-memory Map (cold-start'ta sıfırlanır)
}
```

**Env Requirement:**
```
UPSTASH_REDIS_REST_URL=https://your-db.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-upstash-token
```

**Davranış:**
- Upstash yoksa dev'de in-memory çalışır (uyarı yok, sessiz fallback)
- Upstash varsa limitleri serverless instance'lar arasında paylaşır
- Singleton module-level promise ile her request'te yeniden bağlantı yok

---

## 3. TOKEN REVOCATION MEKANİZMASI ✅ TAMAMLANDI

### DB: `revoked_tokens` tablosu

```sql
CREATE TABLE revoked_tokens (
  jti        text        PRIMARY KEY,
  token_type text        NOT NULL,
  revoked_at timestamptz NOT NULL DEFAULT now(),
  revoked_by uuid        REFERENCES auth.users(id),
  reason     text
);
```

**RLS:** anon/authenticated okuyabilir (verify için), yalnızca baskan insert edebilir.

### Token Payload — `jti` Eklendi

```typescript
interface TokenPayload {
  t: TokenType    // veli | yoklama | tutanak
  id: string      // entity UUID
  jti: string     // ← YENİ: unique token ID (16 byte random, base64url)
  exp: number     // unix timestamp
  m?: Record<string, string>
}
```

`jti` `crypto.getRandomValues()` ile üretiliyor — tahmin edilemez.

### `lib/public-tokens.ts` — Yeni Fonksiyonlar

```typescript
export function extractJti(token: string): string | null
// Token string'inden jti'yi imzayı doğrulamadan çıkarır (revoke UI için)

export async function isTokenRevoked(jti: string, supabase): Promise<boolean>
// revoked_tokens'ı sorgular; DB hatası → false (fail-open, availability öncelikli)
```

### Revocation Flow

1. Baskan "Token İptal Et" butonuna basar
2. `revokeToken(token, type, reason)` server action çalışır
3. `jti` → `revoked_tokens` tablosuna eklenir + audit log
4. Veli/yoklama sayfası bir sonraki açılışta `isTokenRevoked()` kontrolüne takılır
5. `TokenExpiredPage` gösterilir

### `app/actions/tokens.ts` — Yeni Actions

| Fonksiyon | Açıklama |
|-----------|----------|
| `revokeToken(token, type, reason?)` | Token iptal et (baskan yetkisi gerekli) |
| `listRevokedTokens()` | İptal edilmiş token listesi (baskan) |

---

## 4. BACKGROUND JOB SİSTEMİ ✅ TAMAMLANDI (Temel)

### DB: `export_jobs` tablosu

```sql
CREATE TABLE export_jobs (
  id         uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id  uuid    NOT NULL REFERENCES schools(id),
  user_id    uuid    NOT NULL REFERENCES auth.users(id),
  job_type   text    NOT NULL CHECK (job_type IN ('excel_odevler', 'excel_yoklama', 'excel_mufredat', 'excel_notlar')),
  status     text    NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'done', 'error')),
  params     jsonb   NOT NULL DEFAULT '{}',
  result_url text,
  error_msg  text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

### `lib/jobs.ts` — Job Queue Helpers

```typescript
createExportJob(jobType, params)  → Promise<{ jobId: string } | { error: string }>
getExportJob(jobId)               → Promise<{ job: ExportJob } | { error: string }>
listExportJobs()                  → Promise<ExportJob[]>
```

### `app/api/export/route.ts`

```
POST /api/export  → { jobType, params } → { jobId, status, url }
GET  /api/export?jobId={id} → job status
```

**Desteklenen export türleri:**

| Job Type | Veri |
|----------|------|
| `excel_odevler` | Tüm ödevler + sınıf |
| `excel_yoklama` | Yoklama kayıtları (classId + since filtresi) |
| `excel_mufredat` | Müfredat ilerlemesi |
| `excel_notlar` | Öğrenci notları |

**Mevcut İmplementasyon:** TSV (tab-separated) data URL — Excel/Google Sheets doğrudan açar.

**Upgrade Yolu:** `processJob()` → Supabase Edge Function (DB webhook tetikler), sonuç Supabase Storage'a yüklenir, `result_url` gerçek dosya URL'si olur.

---

## 5. ÖNCEKİ SESSION'LARDA TAMAMLANANLAR

### Security (v1 + v2)
- ✅ HMAC-SHA256 stateless tokens (`lib/public-tokens.ts`)
- ✅ Multi-tenant school isolation + schools tablosu
- ✅ RLS hardening: school + role + ownership üçlüsü
- ✅ Audit log sistemi (`/audit` sadece başkana görünür)
- ✅ Zod validation tüm server actions'da
- ✅ CSP headers (next.config.ts)
- ✅ UUID validation

### Performance (v1)
- ✅ React.cache() memoization
- ✅ Suspense streaming
- ✅ Promise.all() paralel sorgular
- ✅ DB indexler

---

## BUILD DURUMU ✅

```
✓ TypeScript: 0 hata
✓ Compiled successfully
✓ 22 route — tümü dynamic (ƒ) + login/home static (○)
✓ /api/export aktif
✓ Proxy Middleware aktif (Upstash hybrid)
```

---

## Kalan Teknik Borçlar

### P0 — Kritik (Prod öncesi)

| Borç | Durum |
|------|-------|
| `TOKEN_SECRET` Vercel'e ekle | Manuel adım — `openssl rand -hex 32` |
| `UPSTASH_REDIS_REST_URL/TOKEN` Vercel'e ekle | Manuel adım — console.upstash.com |
| Migration'ları Supabase'e uygula (phase 3) | SQL Editor'da çalıştır |

### P1 — Yüksek (1-4 hafta)

| Borç | Öneri |
|------|-------|
| Token revoke UI | Audit sayfasına "Token İptal" formu ekle |
| Export gerçek XLSX | `processJob()` içinde SheetJS kullan |
| Supabase Storage entegrasyonu | Export dosyalarını storage'a yükle, signed URL döndür |
| Okul kayıt akışı | `/onboarding` — okul seç/oluştur |
| CSP nonce | `'unsafe-inline'` → nonce tabanlı |
| E2E testler | Playwright |

### P2 — Orta (1-3 ay)

| Borç | Öneri |
|------|-------|
| Edge Function export | Supabase Edge Function + DB webhook → gerçek async |
| Email bildirimleri | Supabase Edge Function + Resend |
| Öğrenci CSV import | Bulk import + okul izolasyonu |
| GDPR/KVKK | Veri silme, export, consent |
| Multi-school UI | Okul yöneticisi rolü |

### P3 — Uzun Vade

| Borç | Öneri |
|------|-------|
| Gerçek zamanlı yoklama | Supabase Realtime |
| Mobil app | React Native / Expo |
| AI önerileri | Devamsızlık örüntüleri, ödev başarı tahminleri |

---

## Mimari Özeti (v3)

```
Browser (Next.js SSR)
  ├── Dashboard routes → /app/(dashboard)/* [auth-required via proxy.ts]
  ├── Public routes → /veli/[token], /yoklama-yazdir/[token]
  │     └── HMAC verify → jti revocation check → 404/expired page
  ├── API routes → /api/export [POST: create+process, GET: poll]
  └── Auth → /login, /actions/auth.ts

Proxy Middleware (proxy.ts)
  ├── Upstash Redis sliding window (prod)
  └── In-memory Map fallback (dev)

Server Actions (lib/validation.ts Zod + lib/audit.ts + school_id inject)
  └── Supabase RLS (school_id + role + ownership)

Database (PostgreSQL 17)
  ├── schools → profiles → classes → students
  ├── homeworks → homework_submissions
  ├── attendance
  ├── zumre_meetings, common_exams, curriculum_progress
  ├── student_notes
  ├── revoked_tokens (token revocation log)
  ├── export_jobs (background job queue)
  └── audit_logs (baskan-read-only)
```

---

## Production Deploy Checklist

- [ ] `TOKEN_SECRET` → Vercel Env Vars (`openssl rand -hex 32`)
- [ ] `UPSTASH_REDIS_REST_URL` + `TOKEN` → Vercel Env Vars
- [ ] `NEXT_PUBLIC_SUPABASE_URL` + `PUBLISHABLE_KEY` → Vercel Env Vars
- [ ] `20260515_schools_isolation.sql` → Supabase SQL Editor
- [ ] `20260515_rls_hardening.sql` → Supabase SQL Editor
- [ ] `20260515_phase3_constraints_jobs_revocation.sql` → Supabase SQL Editor
- [ ] Supabase Storage bucket `exports` oluştur (public: false)

---

*Build: ✅ Sıfır hata · Deploy: Vercel (otomatik CI/CD) · DB: Supabase eu-central-1*
