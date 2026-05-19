# Load Testing

## Kurulum

```bash
# macOS
brew install k6

# Windows (winget)
winget install k6

# Linux
sudo apt install k6
```

## Ortam Değişkenleri

Tüm senaryolar bu değişkenlere ihtiyaç duyar:

| Değişken | Açıklama |
|---|---|
| `BASE_URL` | Uygulama URL'i (default: `http://localhost:3000`) |
| `SUPABASE_URL` | Supabase proje URL'i |
| `SUPABASE_ANON_KEY` | Supabase anon/public key |
| `TEACHER_EMAIL` | Test kullanıcısı e-postası |
| `TEACHER_PASSWORD` | Test kullanıcısı şifresi |
| `CLASS_ID` | Test sınıfı UUID'i |
| `TEACHER_ID` | Test öğretmeni UUID'i |
| `STUDENT_ID` | Test öğrencisi UUID'i |

## Senaryolar

### 1. Toplu Yoklama (`scenarios/attendance.js`)

100 öğretmenin aynı anda yoklama girmesini simüle eder.

```bash
k6 run \
  --env BASE_URL=https://your-app.vercel.app \
  --env SUPABASE_URL=https://xxx.supabase.co \
  --env SUPABASE_ANON_KEY=anon_key_here \
  --env TEACHER_EMAIL=teacher@school.com \
  --env TEACHER_PASSWORD=secret \
  --env CLASS_ID=uuid-here \
  load-tests/scenarios/attendance.js
```

**Yük Profili:**
- 0-30s: 0 → 100 VU (ramp up)
- 30s-2m30s: 100 VU sabit
- 2m30s-3m: 100 → 0 VU (ramp down)

**Başarı Kriteri:** p(95) < 1500ms

---

### 2. Ödev Yönetimi (`scenarios/homework.js`)

Ödev oluşturma (%30) ve durum sorgulama (%70) karışımı.

```bash
k6 run \
  --env BASE_URL=... \
  # ... diğer değişkenler
  load-tests/scenarios/homework.js
```

**Yük Profili:**
- 20 VU sabit ödev oluşturma
- 40 VU ramping güncelleme/sorgulama

**Başarı Kriteri:** p(95) < 2000ms (oluşturma), p(95) < 1000ms (güncelleme)

---

### 3. Raporlama (`scenarios/reports.js`)

Tüm rapor tipleri eşit dağılımla (class / teacher / student / analytics).

```bash
k6 run \
  --env BASE_URL=... \
  --env CLASS_ID=... \
  --env TEACHER_ID=... \
  --env STUDENT_ID=... \
  # ... diğer değişkenler
  load-tests/scenarios/reports.js
```

**Yük Profili:** 30 VU / 4 dakika

**Başarı Kriteri:** p(95) < 3000ms (class/teacher), p(95) < 2000ms (student/analytics)

---

### 4. Eş Zamanlı Export (`scenarios/concurrent-export.js`)

25 kullanıcının aynı anda export tetiklemesini simüle eder.

```bash
k6 run \
  --env BASE_URL=... \
  --env TEACHER_EMAIL=admin@school.com \
  # ... diğer değişkenler
  load-tests/scenarios/concurrent-export.js
```

**Başarı Kriteri:** p(95) < 500ms (enqueue), p(95) < 300ms (status)

> **Not:** Bu test export'un Inngest worker'da işlenmesini değil, sadece kabul endpoint'ini ölçer.

---

### 5. Tam Okul Günü Simülasyonu (`full-load.js`)

8 saatlik okul gününü 12 dakikaya sıkıştırır:
- Sabah giriş dalgası
- İlk ders yoklama burst'u
- Gün içi ödev aktivitesi
- Öğleden sonra yoklama
- Gün sonu raporlama + export

```bash
k6 run \
  --env BASE_URL=... \
  --env CLASS_ID=... \
  --env TEACHER_ID=... \
  --env STUDENT_ID=... \
  # ... diğer değişkenler
  load-tests/full-load.js
```

---

## Sonuç Analizi

k6 testi bittikten sonra önemli metrikler:

```
✓ http_req_duration............: p(95)=1842ms p(99)=3200ms
✓ http_req_failed..............: 0.00%
  iteration_duration............: avg=4.2s
  http_reqs.....................: 12340
```

### Alarm Eşikleri

| Metrik | Uyarı | Kritik |
|---|---|---|
| Hata oranı | > 1% | > 5% |
| Yoklama p(95) | > 1000ms | > 2000ms |
| Rapor p(95) | > 2000ms | > 5000ms |
| Export enqueue p(95) | > 300ms | > 1000ms |

---

## Ölçeklenebilirlik Riskleri

### 1. Yoklama Thundering Herd (YÜKSEK RİSK)

**Risk:** Tüm öğretmenler ders başlangıcında (<2 dakika) yoklama girer.

**Etki:** 100 eş zamanlı `UPSERT` işlemi → Supabase connection pool baskısı.

**Çözüm önerileri:**
- Batch upsert zaten uygulandı (`onConflict: 'class_id,student_id,date'`)
- Supabase Pooler (PgBouncer) kullanımını doğrula
- Gerekirse optimistic queue + debounce ile istek birleştir

---

### 2. Raporlama N+1 Sorguları (ORTA RİSK)

**Risk:** Class report, her öğrenci için ayrı sorgu yapabilir.

**Etki:** 30 öğrencili sınıf için 30+ sorgu → yüksek latency.

**Çözüm önerileri:**
- Mevcut iki aşamalı `.in()` sorgusu bunu kısmen çözer
- `trackedQuery()` ile yavaş sorgu tespiti yap
- Gerekirse class report'u materialized view ile önbelleğe al

---

### 3. Export Worker Bottleneck (ORTA RİSK)

**Risk:** Inngest job queue'su dolduğunda yeni export'lar gecikmeli başlar.

**Etki:** Kullanıcılar export'un "işleniyor" durumunda bekler.

**Çözüm önerileri:**
- Inngest concurrency limiti belirle (`concurrency: { limit: 10 }`)
- Export job status polling yerine webhook veya SSE kullan
- Dead letter (mevcut) ile başarısız job'ları izle

---

### 4. Analytics Sorgu Yükü (DÜŞÜK-ORTA RİSK)

**Risk:** 6 paralel Supabase sorgusu her analytics isteğinde çalışır.

**Etki:** Yoğun dashboard kullanımında DB baskısı artar.

**Çözüm önerileri:**
- `period` bazlı Redis/Vercel KV cache ekle (5 dakika TTL yeterli)
- `PERF.DB_WARN_MS` eşiği ile yavaş analytics sorgularını izle

---

### 5. Supabase Connection Limiti (DÜŞÜK RİSK — Dikkat Et)

**Risk:** Her Supabase plan'ının connection limiti var (Free: 60, Pro: 200+).

**Etki:** Limit aşılırsa yeni sorgular timeout alır.

**Çözüm önerileri:**
- Supabase Dashboard → Database → Connection Pooler: Transaction mode etkin mi?
- Vercel deployment'larında her instance ayrı connection açar — Pooler **zorunlu**
- `pgbouncer=true` connection string parametresini doğrula
