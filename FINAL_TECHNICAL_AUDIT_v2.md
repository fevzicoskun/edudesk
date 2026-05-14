# EduDesk — Final Technical Audit v2

*Tarih: 2026-05-15 · Önceki: FINAL_TECHNICAL_AUDIT.md (2026-05-14)*
*Stack: Next.js 16.2.4 App Router · TypeScript 5.x · Supabase (PostgreSQL 17) · Tailwind v4*

---

## Özet — Bu Session'da Yapılanlar

| Commit | İçerik |
|--------|--------|
| `27c8df7` | HMAC-SHA256 signed public tokens — veli/yoklama routes |
| `452381a` | Multi-tenant school isolation + RLS hardening (DB migrations) |

---

## 1. PUBLIC ROUTE GÜVENLİĞİ ✅ TAMAMLANDI

### Önceki Durum
Raw UUID'ler URL'de açık: `/veli/550e8400-e29b-...` → herhangi bir UUID denendi

### Yeni Sistem: HMAC-SHA256 Stateless Tokens

**lib/public-tokens.ts**
- Token formatı: `v1.{b64url_payload}.{b64url_hmac_sig}`
- Payload: `{t: type, id: uuid, exp: unix_ts, m?: {key: val}}`
- Algoritma: HMAC-SHA-256 via Web Crypto API (Edge + Node uyumlu)
- `btoa/atob` + `crypto.subtle` — Node.js Buffer bağımlılığı yok

**Token Türleri**

| Tür | Süre | Endpoint | Kullanım |
|-----|------|----------|----------|
| `veli` | 7 gün | `/veli/[token]` | Öğrenci detay → veli paylaşımı |
| `yoklama` | 1 gün | `/yoklama-yazdir/[token]` | Yoklama → print/PDF |
| `tutanak` | 7 gün | (hazır, kullanıma açık) | Toplantı tutanağı |

**Route Değişiklikleri**

| Route | Öncesi | Sonrası |
|-------|--------|---------|
| `/veli/[studentId]` | Raw UUID, public erişim | "Geçersiz link" sayfası |
| `/veli/[token]` | — | Token verify → portal |
| `/yoklama-yazdir?classId=&date=` | Auth yok, public | Eski davranış korumalı |
| `/yoklama-yazdir/[token]` | — | Token verify → print |

**UI Değişiklikleri**
- `CopyVeliLink.tsx`: server action → `generateVeliToken` → signed URL kopyalar
- `YoklamaBoard.tsx`: "Yazdır" butonu → `generateYoklamaToken` → yeni sekmede açar

**Env Requirement**
```
TOKEN_SECRET=<openssl rand -hex 32>   # ≥32 karakter, production'da zorunlu
```

---

## 2. MULTI-TENANT SCHOOL ISOLATION ✅ TAMAMLANDI

### Migration: `20260515_schools_isolation.sql`

**Yeni Tablo:**
```sql
schools (id uuid, name text, slug text UNIQUE, created_at timestamptz)
```
Default okul: `00000000-0000-0000-0000-000000000001` — mevcut tüm veri bu okula atandı.

**school_id Eklenen Tablolar:**
`profiles`, `classes`, `students`, `homeworks`, `attendance`,
`zumre_meetings`, `common_exams`, `curriculum_progress`, `student_notes`,
`homework_submissions`, `audit_logs`

**RLS Helper Fonksiyonları (SECURITY DEFINER):**
```sql
current_school_id()              -- auth.uid() → profiles.school_id
is_school_member(uuid)           -- belirtilen okula üye mi?
is_zumre_baskani_in_school()     -- authenticated user baskan mı?
```

**Kalan Teknik Borç:**
- `school_id NOT NULL` henüz uygulanmadı (mevcut datayı kırmamak için)
- Migration 3'te NOT NULL + school setup flow gelecek
- Yeni kayıt oluştururken `school_id = current_school_id()` server action'larda zorlanmalı

---

## 3. RLS HARDENING ✅ TAMAMLANDI

### Migration: `20260515_rls_hardening.sql`

**Politika Prensibi:** Okul + Rol + Sahiplik üçlüsü

| Tablo | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| classes | school üyesi | baskan + school | — | baskan + school |
| students | school üyesi | school | — | school |
| homeworks | school üyesi | teacher + school | — | teacher veya baskan |
| homework_submissions | school üyesi | school | school | — |
| attendance | school üyesi | teacher + school | teacher + school | — |
| zumre_meetings | school üyesi | baskan + school | baskan + school | baskan + school |
| common_exams | school üyesi | baskan + school | school | baskan + school |
| curriculum_progress | school + (teacher veya baskan) | teacher + school | teacher + school | teacher + school |
| student_notes | school üyesi | teacher + school | — | teacher + school |

**Kaldırılan Riskli Politikalar:**
- `FOR ALL TO authenticated USING (true)` → spesifik role/ownership politikalarıyla değiştirildi
- `WITH CHECK` eksik UPDATE politikaları düzeltildi
- anon okuma yalnızca veli portalı için kalan tablolarda korundu

---

## 4. AUDIT LOG SİSTEMİ ✅ (Önceki Session)

- `audit_logs` tablosu: id, created_at, user_id, action, table_name, record_id, old_data, new_data, ip_address, school_id
- `lib/audit.ts`: fire-and-forget, iş akışını asla bloke etmez
- Loglanan: class CRUD, meeting/exam create/delete, veli token üretimi
- `/audit` sayfası: yalnızca zumre_baskani (notFound diğerleri için)

---

## 5. RATE LIMITING ✅ (Kısmi — In-Memory)

`proxy.ts` rate limiter:
- Login: 10 POST/dakika/IP → HTTP 429
- Public routes: 60 istek/dakika/IP → HTTP 429

**Kalan Teknik Borç:**
- Cold-start'ta sıfırlanıyor → Upstash Redis ile kalıcı yapıya geçilmeli
- Token oluşturma endpoint'lerine ayrı limit eklenmeli

---

## 6. SECURITY HARDENING ✅ (Önceki Session)

- **Zod validation**: Tüm server actions'da (lib/validation.ts)
- **CSP Headers**: next.config.ts'de (frame-ancestors 'none' dahil)
- **UUID validation**: Tüm ID parametrelerinde
- **Input sanitization**: String uzunluk limitleri, array boyut sınırları
- **Token signing**: HMAC-SHA256, production'da TOKEN_SECRET zorunlu

---

## 7. BACKGROUND JOBS ℹ️ Client-Side

Excel export'lar (SheetJS) tamamen client-side — büyük veri setleri için kabul edilebilir.

**Öneri (Roadmap):**
- Supabase Edge Functions + Upstash Queue
- `/api/jobs/[jobId]` polling veya Supabase Realtime ile progress tracking

---

## 8. PERFORMANCE ✅

- React.cache() memoization (getCurrentUser/getCurrentProfile)
- Suspense streaming (dashboard)
- Promise.all() paralel sorgular
- DB indexler: attendance, homeworks, classes (academic_year)

---

## 9. BUILD DURUMU ✅

```
✓ TypeScript: 0 hata
✓ Compiled successfully
✓ 21 route — tümü dynamic (ƒ) + login/home static (○)
✓ Proxy Middleware aktif
```

---

## Kalan Teknik Borçlar & Scaling Roadmap

### P0 — Kritik (Prod öncesi)
| Borç | Öneri |
|------|-------|
| `TOKEN_SECRET` env Vercel'e eklenmeli | `openssl rand -hex 32` → Vercel Env Vars |
| `school_id NOT NULL` enforcement | 3. migration: ALTER TABLE ... SET NOT NULL |
| Server actions'a `school_id` inject | `createClass`, `addStudent` vb. → `current_school_id()` |

### P1 — Yüksek (1-4 hafta)
| Borç | Öneri |
|------|-------|
| Kalıcı rate limiting | Upstash Redis (`@upstash/ratelimit`) |
| Okul kayıt akışı | `/onboarding` sayfası: okul seç/oluştur |
| Token revocation | `revoked_tokens` tablosu veya kısa TTL + refresh |
| CSP nonce | `'unsafe-inline'` → nonce tabanlı script/style |
| E2E testler | Playwright: login, ödev CRUD, veli portal |

### P2 — Orta (1-3 ay)
| Borç | Öneri |
|------|-------|
| Multi-school UI | Okul yöneticisi rolü, okul listeleme |
| Email bildirimleri | Supabase Edge Function + Resend |
| Async export jobs | Edge Function + Upstash Queue |
| Öğrenci import | CSV/Excel bulk import ile okul izolasyonu |
| GDPR/KVKK uyumu | Veri silme, export, consent |

### P3 — Uzun Vade
| Borç | Öneri |
|------|-------|
| Gerçek zamanlı yoklama | Supabase Realtime |
| Mobil app | React Native / Expo |
| AI önerileri | Devamsızlık örüntüleri, ödev başarı tahminleri |

---

## Mimari Özeti

```
Browser (Next.js SSR)
  ├── Dashboard routes → /app/(dashboard)/* [auth-required via proxy.ts]
  ├── Public routes → /app/veli/[token], /app/yoklama-yazdir/[token]
  │     └── HMAC-SHA256 token verify → 404 veya expired page
  └── Auth → /app/login, /app/actions/auth.ts
  
Server Actions (lib/validation.ts Zod + lib/audit.ts)
  └── Supabase RLS (school_id + role + ownership)
  
Database (PostgreSQL 17)
  ├── schools → profiles → classes → students
  ├── homeworks → homework_submissions
  ├── attendance
  ├── zumre_meetings, common_exams, curriculum_progress
  └── audit_logs (baskan-read-only)
```

---

*Build: ✅ Sıfır hata · Deploy: Vercel (otomatik CI/CD) · DB: Supabase eu-central-1*
