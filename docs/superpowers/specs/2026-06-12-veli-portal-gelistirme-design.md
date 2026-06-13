# EduDesk — Veli Portal Geliştirme

**Tarih:** 2026-06-12  
**Kapsam:** 4 özellik — WhatsApp paylaşım, toplu link, token süre göstergesi, veli engagement analytics

---

## Özellik 1 — WhatsApp Paylaşım Butonu

### Problem
`CopyVeliLink` bileşeninde sadece "Kopyala" var. Öğretmen linki kopyalayıp WhatsApp'ı açıp veliye paste etmek zorunda — 3 adım yerine 1 adım olabilir.

### Tasarım

`CopyVeliLink.tsx`'te yeni link oluşturulduğunda (fresh state) "Kopyala" butonunun yanına WhatsApp paylaşım butonu eklenir.

**WhatsApp deep link formatı:**
```
https://wa.me/?text=Sayın+{veli_ad},+{ogrenci_ad}+için+EduDesk+veli+portalı:+{url}
```

Veli adı yoksa: `{ogrenci_ad} için EduDesk veli portalı: {url}`

`CopyVeliLink`'e `studentName` ve `veliAd` prop'ları eklenir (öğrenci profil sayfasından geçilir). WhatsApp ikonu + "WhatsApp'ta Gönder" butonu.

**Dosya değişiklikleri:**
- `CopyVeliLink.tsx` — prop ekle, WhatsApp butonu
- `siniflar/[id]/ogrenciler/[studentId]/page.tsx` — prop'ları geç

---

## Özellik 2 — Toplu Veli Link Gönderimi

### Problem
Şu an sınıftaki 30 öğrenci için tek tek öğrenci profiline girip link oluşturuyorsun. Dönem başında veya yeni öğretmen tanışma sürecinde tüm velilere link göndermek saatler alıyor.

### Tasarım

**Sınıf sayfasında** (`siniflar/[id]` veya öğrenci listesi üst kısmı) yeni buton: "Toplu Veli Linki Oluştur".

Buton tıklanınca modal açılır:

1. **İlk adım — oluştur**: "Bu sınıftaki tüm öğrenciler için veli linki oluşturulsun mu?" → "Oluştur" butonu. Action: her öğrenci için `generateVeliToken` çağrılır (batch server action).

2. **İkinci adım — gönder**: Tablo görünümü:
   ```
   | Öğrenci Adı  | Veli Adı    | WhatsApp | Kopyala |
   |--------------|-------------|----------|---------|
   | Ali Vural    | Fatma Vural | [icon]   | [icon]  |
   | Ayşe Kaya    | Ahmet Kaya  | [icon]   | [icon]  |
   ```
   - WhatsApp: `wa.me/?text=...` deep link
   - Kopyala: tek öğrenci linkini panoya alır
   - "Tümünü Kopyala" butonu — tüm linkleri `\n` ile birleştirir
   - Veli telefonu olmayan öğrenciler sarı uyarı badge'i ile işaretlenir

**Server Action:** `generateBulkVeliTokens(classId: string): Promise<BulkTokenResult[]>`
```ts
type BulkTokenResult = {
  studentId: string
  studentName: string
  veliAd: string | null
  veliTelefon: string | null
  token: string
  url: string
}
```

**Dosya değişiklikleri:**
- `app/actions/tokens.ts` — `generateBulkVeliTokens` eklenir
- `app/(dashboard)/siniflar/[id]/ogrenciler/BulkVeliLinkModal.tsx` — YENİ
- `app/(dashboard)/siniflar/[id]/ogrenciler/page.tsx` veya `OgrenciListesi.tsx` — modal trigger butonu

---

## Özellik 3 — Veli Engagement Analytics

### Problem
Öğretmen linki gönderdi ama veli açtı mı? Kaç dakika baktı? Sadece devamsızlığa mı baktı, ödevlere de mi? Bu bilgiler olmadan "veli ilgilenmiyor" algısı subjektif kalıyor.

### DB Migrasyonu

```sql
CREATE TABLE IF NOT EXISTS veli_portal_events (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  token_jti     TEXT NOT NULL,
  student_id    UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  school_id     UUID NOT NULL,
  event_type    TEXT NOT NULL CHECK (event_type IN ('page_view', 'section_view', 'session_end')),
  section       TEXT CHECK (section IN ('odevler', 'devamsizlik', 'notlar')),
  duration_sec  INTEGER,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_vpe_student ON veli_portal_events(student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vpe_school  ON veli_portal_events(school_id);
-- RLS yok: sadece service client (API route) insert, sadece authenticated öğretmenler okur
```

### Client-Side Tracker (`app/veli/[token]/VeliTracker.tsx`)

`'use client'` bileşeni, veli sayfasına invisible olarak eklenir.

```
page load → POST /api/veli/event { type: 'page_view' }
sections IntersectionObserver → POST /api/veli/event { type: 'section_view', section: 'odevler' | 'devamsizlik' | 'notlar' }
visibilitychange/beforeunload → POST /api/veli/event { type: 'session_end', duration_sec: elapsed }
```

**Kurallar:**
- Her section sadece bir kez raporlanır (Set ile takip)
- Session süresi: `Date.now()` mount'ta başlar, unload'da gönderilir (`navigator.sendBeacon`)
- Token sayfadan geçilir (prop) — API route token'ı doğrular

### API Route (`app/api/veli/event/route.ts`)

```
POST /api/veli/event
Body: { token, event_type, section?, duration_sec? }
```
- Token JWT doğrulaması + revoke kontrolü
- `student_id` ve `school_id` token'dan alınır (kullanıcı girmez)
- Rate limit: IP başına dakikada 30 istek

### Öğretmen Analytics Görünümü

**A) Öğrenci profil sayfasında:**

Yeni `VeliAnalyticsCard` server component:
```
📊 Veli Portalı Aktivitesi
┌─────────────────────────────────────┐
│ 3 ziyaret · Son: 2 gün önce         │
│ Toplam süre: ~15 dk                 │
│ Görüntülenen: Ödevler ✓  Dev. ✓  Notlar ✗ │
└─────────────────────────────────────┘
```

**B) Sınıf öğrenci listesinde:**

`OgrenciSatiri`'ne küçük badge: `👁 3` (toplam page_view sayısı). Hiç açılmamışsa gri `👁 0`.

**Dosya değişiklikleri:**
- `supabase/migrations/` — yeni migration
- `app/api/veli/event/route.ts` — YENİ
- `app/veli/[token]/VeliTracker.tsx` — YENİ
- `app/veli/[token]/page.tsx` — VeliTracker ekle
- `src/domains/classes/repositories/ClassRepository.ts` — `getVeliAnalytics(studentId)` ve `getVeliViewCounts(classId)`
- `app/(dashboard)/siniflar/[id]/ogrenciler/[studentId]/VeliAnalyticsCard.tsx` — YENİ
- `app/(dashboard)/siniflar/[id]/ogrenciler/[studentId]/page.tsx` — VeliAnalyticsCard ekle
- `app/(dashboard)/siniflar/[id]/ogrenciler/OgrenciSatiri.tsx` veya benzer — view count badge

---

## Özellik 4 — Token Süre Göstergesi

### Problem
Veli linki açıyor ama linkin ne zaman dolacağını bilmiyor. Öğretmen de kaç günde bir yeni link oluşturması gerektiğini görmüyor.

### Tasarım

**Veli sayfasında** header'a, öğrenci adının yanına küçük badge:
```
🔗 15 Temmuz'a kadar geçerli   (yeşil, >30 gün)
🔗 5 gün kaldı                 (sarı, 7-30 gün)  
🔗 1 gün kaldı                 (turuncu, <7 gün)
```

Token'ın `expires_at` bilgisi zaten `verifyPublicToken` ile decode ediliyor. Bunu page.tsx'te hesapla, header'a geç.

**Dosya değişiklikleri:**
- `app/veli/[token]/page.tsx` — expires_at hesapla, header badge'i ekle

---

## Uygulama Sırası

| Sıra | Özellik | Bağımlılık |
|------|---------|------------|
| 1 | DB migration (veli_portal_events) | Bağımsız |
| 2 | API route + VeliTracker | Migration (1) |
| 3 | Token süre göstergesi | Bağımsız |
| 4 | WhatsApp paylaşım butonu | Bağımsız |
| 5 | Toplu link modal | Bağımsız |
| 6 | Analytics repository + UI | API route (2) |

---

## Test Yaklaşımı

- Analytics repository'nin pure function kısmı (veri aggregation) unit test
- Toplu token oluşturma action'ı integration test
- WhatsApp URL formatı unit test (pure function)
