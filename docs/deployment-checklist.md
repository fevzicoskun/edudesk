# Deploy Öncesi Kontrol Listesi

Production'a (Vercel) çıkmadan önce bu listeyi gözden geçir. Env değişkenlerinin
açıklamaları için `.env.example`'a bak.

## 1. Supabase
- [ ] `NEXT_PUBLIC_SUPABASE_URL` ve `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` ayarlandı
- [ ] `SUPABASE_SERVICE_ROLE_KEY` ayarlandı (Vercel env vars — asla client'a sızmaz)
- [ ] Tüm migration'lar uygulandı (`supabase/migrations/*` — schema.sql DEĞİL, o eski snapshot)
- [ ] RLS politikaları aktif; `get_advisors` ile RLS/security uyarıları kontrol edildi
- [ ] Dashboard > Auth > Allowed Redirect URLs güncellendi
- [ ] Dashboard > Database > SSL Mode = require

## 2. Güvenlik
- [ ] `TOKEN_SECRET` en az 32 karakter ve rastgele (`openssl rand -hex 32`)
- [ ] `UNSUBSCRIBE_SECRET` ayarlandı (prod'da zorunlu — yoksa /api/unsubscribe çöker)

## 3. Rate Limiting (Upstash Redis)
- [ ] `UPSTASH_REDIS_REST_URL` ve `UPSTASH_REDIS_REST_TOKEN` ayarlandı
- [ ] `RATE_LIMIT_FAIL_MODE=closed` (varsayılan güvenli mod)
- Not: Redis yoksa hassas endpoint'ler (/login, /kayit, /onboarding) fail-closed çalışır.

## 4. E-posta (Resend)
- [ ] `RESEND_API_KEY` ayarlandı
- [ ] Domain (myedudesk.com.tr) Resend > Domains'e eklendi ve DNS doğrulandı
- [ ] `RESEND_FROM`, `FEEDBACK_TO`, `ALERT_EMAIL` ayarlandı

## 5. Background Jobs (Inngest)
- [ ] `INNGEST_DEV` satırı kaldırıldı / tanımlı değil (production'da)
- [ ] `INNGEST_SIGNING_KEY` ayarlandı — /api/inngest rate-limit'ten muaf olduğu için
      webhook imza doğrulaması kritik
- [ ] `INNGEST_EVENT_KEY` ayarlandı

## 6. Web Push (VAPID — opsiyonel)
- [ ] `VAPID_SUBJECT`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` ayarlandı
      (üçü de yoksa web push zarifçe devre dışı kalır, app çalışır)

## 7. Health Checks
- [ ] `/api/live` 200 dönüyor (liveness — sıfır bağımlılık)
- [ ] `/api/ready` 200/503 dönüyor (readiness — Supabase bağlantısı)
- [ ] `/api/health` çalışıyor (DB latency + durum)
- [ ] Uptime monitörü bu endpoint'lere bağlandı (login redirect almadıkları doğrulandı)

## 8. Loglama
- [ ] `LOG_LEVEL=info` veya `warn` (production'da `debug` değil)

## 9. E2E Test Ortamı (opsiyonel — CI için)
- [ ] `PLAYWRIGHT_BASE_URL` ve `TEST_EMAIL_*` / `TEST_PASSWORD_*` ayarlandı
      (tanımsızsa fallback değerler kullanılır)

## 10. Yedekleme ve KVKK

**Yedekleme:**
- Supabase Pro plan: 7 günlük Point-in-Time Recovery (PITR) varsayılan aktif
- Dashboard > Database > Backups bölümünden kontrol edin
- Önerilen: günlük otomatik backup + haftalık dışa aktarma (pg_dump)
- Kritik tablolar: `profiles`, `homeworks`, `homework_submissions`, `attendance`, `grades`

**Soft-delete:**
- Tüm ana tablolarda `deleted_at` sütunu; silinen kayıtlar fiziksel silinmez
- Tüm sorgularda `.is('deleted_at', null)` filtresi (CLAUDE.md)

**Kalıcı silme (KVKK / GDPR):**
- Hesap silme talebi → `profiles`'tan hard-delete + `supabase.auth.admin.deleteUser`
- Soft-delete kayıtları 90 gün sonra kalıcı silinmeli
- Planlanan: Inngest scheduled job (aylık) → 90+ gün önce silinenleri temizle
- Öğrenci verileri KVKK kapsamında: veri işleme sözleşmesi + gizlilik politikası zorunlu
