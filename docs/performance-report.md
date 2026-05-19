# Performans Analiz Raporu

**Analiz tarihi:** 2026-05-19  
**Kapsam:** `/anasayfa`, `/raporlar/mentor`, `/raporlar/ogrenci`, `/mentorluk`  
**Yöntem:** Statik kod analizi + `perfTimer`/`perfGroup` instrumentation

---

## Özet Tablo

| Sayfa / Bileşen                | Toplam Sorgu | Paralel | Seri (Waterfall) | Önemli Sorun |
|-------------------------------|:---:|:---:|:---:|---|
| `/anasayfa` (ogretmen)         | 8   | 6   | 2              | Duplicate `classes` sorgusu, widget waterfall |
| `/anasayfa` (mudur)            | 11  | 7   | 1              | `user_sessions` waterfall, `zumre_meetings.notes` over-fetch |
| `/anasayfa` (mudur_yardimcisi) | 8   | 5   | 1              | `user_sessions` waterfall, tüm öğrenciler over-fetch |
| `/raporlar/mentor`             | 4   | 2   | 1              | `profiles` waterfall (2. seviye) |
| `/raporlar/ogrenci` (ogretmen) | 3   | 0   | 3              | Anti-pattern: homework → class_id |
| `/mentorluk`                   | 5   | 3   | 0              | — |

---

## Waterfall Sorunları

### 1. `DersProgramiWidget` — 2 sorgu seri (anasayfa/ogretmen)

**Dosya:** `app/(dashboard)/anasayfa/DersProgramiWidget.tsx`  
**Tahmini ek gecikme:** ~80–150ms

```
classes WHERE mentor_teacher_id = ?   ← Q1 tamamlanmadan Q2 başlayamaz
     ↓ (mentorClassIds bekleniyor)
lesson_schedules WHERE teacher_id = ? OR class_id IN (...)  ← Q2
```

**Kök neden:** `mentorClassIds` yoksa fallback query farklılaşıyor, ancak her iki sorgu da aynı `school_id` filtresiyle tek bir JOIN sorguya indirgene­bilir.

**Öneri:**
```sql
SELECT ls.*, c.name, c.grade
FROM lesson_schedules ls
LEFT JOIN classes c ON c.id = ls.class_id
WHERE ls.school_id = $1
  AND (ls.teacher_id = $2 OR c.mentor_teacher_id = $2)
  AND ls.file_url IS NOT NULL
ORDER BY ls.schedule_type
```
Tek sorguda `mentor_teacher_id` JOIN ile waterfall ortadan kalkar.

---

### 2. `MudurDashboard` — `user_sessions` waterfall

**Dosya:** `app/(dashboard)/anasayfa/MudurDashboard.tsx` (satır ~87)  
**Tahmini ek gecikme:** ~60–120ms

`profiles` sorgusundan gelen `teacherIds` alındıktan sonra başlıyor.

**Öneri:** `user_sessions` sorgusu `school_id` ile doğrudan çekilebilir:
```ts
supabase.from('user_sessions')
  .select('user_id, login_at, last_seen_at, duration_minutes')
  .eq('school_id', school_id)   // school_id zaten mevcut
```
Böylece `teacherIds`'e bağımlılık kalkar, 7'li `Promise.all`'a dahil edilebilir.

---

### 3. `MudurYardimcisiDashboard` — `user_sessions` waterfall

**Dosya:** `app/(dashboard)/anasayfa/MudurYardimcisiDashboard.tsx` (satır ~71)  
**Aynı çözüm:** `school_id` ile direkt sorgulama.

---

### 4. `raporlar/mentor` — `profiles` waterfall (2. seviye)

**Dosya:** `app/(dashboard)/raporlar/mentor/page.tsx` (satır ~44)  
**Tahmini ek gecikme:** ~50–100ms

```
mentor_reports + classes  (paralel, doğru)
     ↓ (mentorIds bekleniyor)
profiles WHERE id IN (mentorIds)   ← waterfall
```

**Öneri:** `mentor_reports` sorgusuna `profiles` ilişkisi join edilebilir:
```ts
supabase.from('mentor_reports')
  .select('..., profiles!mentor_id(id, full_name)')
```
PostgREST tek seferde çözer, üçüncü round-trip ortadan kalkar.

---

## Duplicate Query Sorunları

### 5. `MentorSinifimWidget` + `DersProgramiWidget` — aynı sorgu ×2

**Dosyalar:**
- `app/(dashboard)/anasayfa/MentorSinifimWidget.tsx`
- `app/(dashboard)/anasayfa/DersProgramiWidget.tsx`

Her iki bileşen de ayrı ayrı şunu çalıştırıyor:
```ts
supabase.from('classes').select('id, name, grade')
  .eq('mentor_teacher_id', user.id)
```

**Öneri:** Bu sorguyu `anasayfa/page.tsx`'de bir kez çalıştırıp her iki bileşene prop olarak geçirin.  
`getCurrentUser()` zaten `cache()` ile korunuyor ama Supabase sorguları memoize edilmiyor.

---

### 6. `schools` tablosu ×2 (mudur akışı)

- `app/(dashboard)/layout.tsx`: onboarding kontrolü için `schools` sorgusu
- `MudurDashboard.tsx`: yeniden `schools` sorgular (`schoolRes`)

**Öneri:** Layout'tan gelen `school` verisini prop/context ile ilet ya da `MudurDashboard` için ayrı çekmeden layout verisini kullan.

---

## Over-Fetching Sorunları

### 7. `MudurYardimcisiDashboard` — tüm öğrenciler tam profil

**Dosya:** `MudurYardimcisiDashboard.tsx` satır ~47

```ts
supabase.from('students')
  .select('id, full_name, class_id')  // full_name risk analizi için kullanılıyor
  .eq('school_id', school_id)
```

`full_name` yalnızca devamsızlık riskindeki 10 öğrenci için gösteriliyor.  
Büyük okullarda (500+ öğrenci) payload gereksiz şişer.

**Öneri:** Sadece ID + class_id çek, risk eşiğini aşan öğrencilerin full_name'ini ikinci sorguda al.

---

### 8. `MudurYardimcisiDashboard` — 30 günlük tüm yoklama kayıtları

```ts
supabase.from('attendance')
  .select('class_id, student_id, date, status')
  .eq('school_id', school_id)
  .gte('date', thirtyDaysAgo)
```

500 öğrenci × 20 okul günü = 10.000 satır. Sadece `absent` status gerekiyor.

**Öneri:**
```ts
.select('student_id, class_id, date')
.eq('school_id', school_id)
.eq('status', 'absent')
.gte('date', thirtyDaysAgo)
```
Payload ~%70–80 küçülür.

---

### 9. `MudurDashboard` — `zumre_meetings.notes` over-fetch

**Dosya:** `MudurDashboard.tsx` satır ~52

```ts
supabase.from('zumre_meetings')
  .select('id, title, meeting_date, branch, notes')  // notes kullanılmıyor
```

`notes` alanı UI'de hiç gösterilmiyor. 50 kayıt limit var ama her `notes` alanı büyük metin olabilir.

**Öneri:** `notes` alanını select'ten çıkar.

---

## Anti-Pattern

### 10. `raporlar/ogrenci` — homework → class_id anti-pattern

**Dosya:** `app/(dashboard)/raporlar/ogrenci/page.tsx` satır ~14

```ts
// YANLIŞ: Sınıfları bulmak için ödevleri kullanıyor
supabase.from('homeworks')
  .select('class_id, classes(id, name, grade)')
  .eq('teacher_id', userId)
  .limit(500)
```

Ardından JavaScript'te unique `class_id` seti çıkarılıyor.

**Doğru yaklaşım:**
```ts
supabase.from('classes')
  .select('id, name, grade')
  .eq('school_id', school_id)
  // veya teacher_id ile ilişkilendirilmişse:
  .eq('homeroom_teacher_id', userId)
```
Ya da `class_teachers` ara tablosu varsa oradan.

---

### 11. `supabase.auth.getUser()` tekrarı — cache bypass

**Dosyalar:**
- `app/(dashboard)/raporlar/ogrenci/page.tsx` satır ~18
- `app/(dashboard)/raporlar/ogretmen/page.tsx`

Doğrudan `supabase.auth.getUser()` çağrısı, `getCurrentUser()` cache'ini bypass eder → ek network round-trip.

**Öneri:** Her yerde `import { getCurrentUser } from '@/src/shared/auth'` kullan.

---

## Index Önerileri

Aşağıdaki sorgular yüksek frekanslı ve büyük tablolarda tam-scan riski taşıyor:

| Tablo | Kolon(lar) | Sorgu Tipi | Öncelik |
|-------|-----------|-----------|---------|
| `homeworks` | `(school_id, teacher_id)` | equality filter | Yüksek |
| `attendance` | `(school_id, date, status)` | range + equality | Yüksek |
| `attendance` | `(school_id, student_id)` | equality | Yüksek |
| `classes` | `mentor_teacher_id` | equality | Orta |
| `mentor_reports` | `(school_id, report_date)` | range | Orta |
| `user_sessions` | `user_id` | IN list | Orta |
| `lesson_schedules` | `teacher_id` | equality | Düşük |

---

## Caching Fırsatları

| Veri | Mevcut Durum | Öneri |
|------|-------------|-------|
| `schools` (isim, slug) | Her istekte sorgu | `revalidate = 3600` veya layout'ta cache |
| `classes` listesi | Her istekte | Next.js `unstable_cache` ile 60s |
| `/anasayfa` ogretmen | `revalidate = 60` ✓ | Yeterli |
| `/mentorluk` | `revalidate = 0` | 30s ISR yeterli, tamamen no-cache gerekmez |

---

## Server/Client Boundary İyileştirmeleri

1. **`SubmissionsPanel`** — Client bileşen değil, Server Component olarak kalması doğru. Ancak `hwIds` array'i büyüdüğünde (zumre_baskani tüm ödevleri görür) `.in()` sorgusu yavaşlar. Max `hwIds` sayısına cap koymayı düşünün (örn. son 100 ödev).

2. **`AjandaWidget`** — İnteraktif (client) olması doğru. Başlangıç verisi server'dan prop olarak geliyor ✓.

3. **`DersProgramiWidget`** — Tamamen statik (dosya URL'leri). `revalidate` değeriyle ISR'a alınabilir, Suspense boundary'den kaldırılabilir.

---

## Instrumentation Kullanımı

Eklenen `perfTimer` ve `perfGroup` wrapper'ları sadece `NODE_ENV !== 'production'` ortamında çalışır. Geliştirme sırasında konsol çıktısı:

```
[perf] 🟢 anasayfa:ogretmen:parallel-queries (group): 45ms
[perf] 🟢 DersProgramiWidget:classes (step 1 of waterfall): 23ms
[perf] 🟢 DersProgramiWidget:lesson_schedules (step 2 of waterfall): 31ms
[perf] 🟡 WARN mudur-dashboard:parallel-queries (group): 520ms
[perf] 🟢 mudur-dashboard:user_sessions (sequential — waterfall after profiles): 18ms
```

**Kaldırmak için:** `src/shared/perf/index.ts`'i silin ve `_t1`, `_t2` değişkenleri ile `.log()`/`.done()` çağrılarını dosyalardan temizleyin.

---

## Öncelik Sırası

| Öncelik | Aksiyon | Beklenen Kazanım |
|---------|---------|-----------------|
| 🔴 1 | `attendance` sorgusu filtrele (`status = 'absent'`) | ~%70 payload azalması |
| 🔴 2 | `user_sessions` waterfallını `school_id` ile kır | ~60–120ms tasarruf |
| 🟡 3 | `DersProgramiWidget` waterfallı JOIN ile birleştir | ~80–150ms tasarruf |
| 🟡 4 | `mentor_reports/profiles` waterfallı join ile kır | ~50–100ms tasarruf |
| 🟡 5 | `raporlar/ogrenci` anti-pattern düzelt | Doğruluk + hız |
| 🟢 6 | `zumre_meetings.notes` kaldır | Küçük payload iyileştirme |
| 🟢 7 | `schools` duplicate sorgusunu ortadan kaldır | Küçük |
| 🟢 8 | `getCurrentUser()` cache'i her yerde kullan | Güvenilirlik |
