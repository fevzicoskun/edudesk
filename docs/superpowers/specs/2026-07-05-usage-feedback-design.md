# Kullanım Metrikleri + Uygulama İçi Geri Bildirim — Tasarım

**Tarih:** 2026-07-05
**Durum:** Onaylandı (sözlü tasarım onayı alındı; spec incelemesi bekleniyor)

## Amaç

Pilot okul aşamasında ürün kararlarını veriye bağlamak için iki hafif sinyal kaynağı:

1. **Pasif kullanım metrikleri** — hangi rol hangi modüle ne sıklıkla giriyor, günlük aktif kullanıcı kaç.
2. **Açık geri bildirim** — öğretmenlerin öneri/hata bildirimi yazabileceği uygulama içi buton.

Her ikisi de yalnızca süper-admin (/platform) tarafından görülür. Okul yönetimi bu verilere erişmez (öğretmen otosansürünü önlemek için bilinçli karar).

## Kapsam Dışı (YAGNI)

- Aksiyon-bazlı event izleme ("yoklama kaydedildi" vb.) — sayfa görünümü yeterli sinyal.
- Grafik kütüphanesi — /platform'da tablo/sayı kartları yeterli.
- Feedback'e cevap verme / durum takibi akışı.
- E-posta bildirimi (yeni feedback geldiğinde).
- Vercel Analytics veya üçüncü parti analytics servisi.

## Bölüm 1: Kullanım Metrikleri

### Veri modeli — `usage_daily`

```sql
create table usage_daily (
  day        date        not null,
  school_id  uuid        not null references schools(id),
  user_id    uuid        not null,          -- auth.users referansı
  role       text        not null,          -- profildeki rol (denormalize)
  feature    text        not null,          -- 'yoklama', 'odevler', 'takvim' ...
  count      integer     not null default 1,
  primary key (day, school_id, user_id, feature)
);
```

- **Hacim:** kullanıcı × özellik × gün. 50 öğretmen × 10 özellik × 30 gün ≈ 15k satır/ay — önemsiz.
- Bu şema tek tablodan iki soruyu cevaplar:
  - Günlük aktif kullanıcı: `count(distinct user_id)` gün bazında.
  - Özellik popülerliği: `sum(count)` feature bazında.
- `deleted_at` yok — metrik verisi soft-delete gerektirmez (bilinçli sapma).

### Yazım yolu — RPC `increment_usage(p_feature text)`

`SECURITY DEFINER` fonksiyon; `auth.uid()`'den kimliği, `profiles`'tan `school_id` ve `role`'ü kendisi türetir. İstemciden yalnızca `feature` alınır — kimlik alanlarına istemci güvenilmez. Atomik upsert:

```sql
insert into usage_daily (day, school_id, user_id, role, feature)
values (current_date, v_school_id, auth.uid(), v_role, p_feature)
on conflict (day, school_id, user_id, feature)
do update set count = usage_daily.count + 1;
```

- `authenticated` rolüne EXECUTE verilir (anon'a verilmez).
- Profil bulunamazsa sessizce çıkar (`return`) — metrik yazımı hiçbir akışı kırmamalı.
- Tabloya doğrudan RLS policy açılmaz: authenticated INSERT/SELECT/UPDATE edemez; okuma yalnızca service-role (/platform).

### Yakalama — client beacon

- `app/(dashboard)/` altına küçük bir client component: `UsageTracker.tsx`, dashboard `layout.tsx`'e eklenir.
- `usePathname()` değişimini izler; route → feature eşlemesi client'ta sabit bir map (örn. `/yoklama/*` → `yoklama`). Map'te olmayan route izlenmez.
- `navigator.sendBeacon('/api/usage', ...)` ile gönderilir — sayfa geçişini bloklamaz. Cookie'ler same-origin gittiği için `/api/usage` route'u mevcut session'ı görür.
- `/api/usage` (POST): session'dan kullanıcıyı doğrular, Zod ile `feature` değerini doğrular (bilinen feature listesi enum'u), `increment_usage` RPC'sini çağırır. Oturum yoksa 204 döner (hata üretmez).
- Aynı sayfada art arda render'larda tekrar saymamak için component son gönderilen feature'ı ref'te tutar; feature değişmeden tekrar göndermez.

### Bilinen sınırlar (kabul edildi)

- SPA içi geri/ileri gezinme sayıları şişirebilir — pilot için sorun değil.
- `sendBeacon` reklam engelleyicilere takılabilir — kayıp tolere edilir, kritik veri değil.

## Bölüm 2: Geri Bildirim

### Veri modeli — `feedback`

```sql
create table feedback (
  id         uuid        primary key default gen_random_uuid(),
  school_id  uuid        not null references schools(id),
  user_id    uuid        not null,
  role       text        not null,
  page_path  text        not null,          -- gönderildiği sayfa, otomatik
  category   text        not null check (category in ('oneri', 'hata', 'diger')),
  message    text        not null check (char_length(message) between 3 and 2000),
  created_at timestamptz not null default now()
);
```

- RLS: SELECT/UPDATE/DELETE policy yok — okuma yalnızca service-role (/platform).
- Yazım server action üzerinden service-role ile değil, kullanıcı session'ı ile yapılır; INSERT policy: `user_id = auth.uid()` ve `school_id` kullanıcının profilindeki okulla eşleşmeli.
- Dikkat: SELECT policy olmadığı için repo `.insert()` sonrası `.select()` ÇAĞIRMAZ (returning satır okuyamaz, sorgu patlar). Insert dönüşü kullanılmaz.

### Akış — mevcut katman deseni

```
app/actions/feedback.ts → src/domains/feedback/services/FeedbackService.ts
                        → src/domains/feedback/repositories/FeedbackRepo.ts
```

- Action: Zod doğrulama (kategori enum + mesaj uzunluğu) → service.
- Service: `getAbility()` ile kimlik/okul; her rol feedback gönderebilir (permission kontrolü yok — bilinçli, herkese açık).
- Basit rate-limit: aynı kullanıcıdan son 1 dakikada kayıt varsa reddet (repo'da tek sorgu) — spam koruması.

### UI — FeedbackButton

- `app/(dashboard)/FeedbackButton.tsx` (client): layout'a eklenen sabit küçük buton (mevcut PushTesvikSeridi gibi layout seviyesinde).
- Tıklanınca dialog: kategori seçimi (öneri / hata / diğer) + çok satırlı metin + gönder.
- `page_path` `usePathname()`'den otomatik dolar, kullanıcı görmez.
- Başarıda kısa teşekkür mesajı, dialog kapanır.

## Bölüm 3: /platform Görünümü

`app/platform/page.tsx`'e (veya sayfa büyürse alt bileşenlere) iki bölüm eklenir, mevcut `createServiceClient()` deseniyle:

1. **Kullanım kartı:** son 7 ve 30 gün için okul bazında: aktif kullanıcı sayısı, en çok kullanılan 5 özellik (sum count). Basit tablo, grafik yok.
2. **Geri bildirim listesi:** son 50 kayıt; tarih, okul, rol, kategori, mesaj, sayfa. Salt-okunur liste.

Aggregate sorguları SQL'de yapılır (service client + `usage_daily` üzerinde group by) — veri /platform'a ham taşınmaz.

## Test Stratejisi

- **Unit:** route → feature map fonksiyonu; feedback Zod şeması; rate-limit karar mantığı (repo mock).
- **Integration:** `increment_usage` RPC — aynı gün iki çağrıda count=2, farklı feature'da ayrı satır; feedback INSERT policy (kendi adına yazabilir, başkası adına yazamaz).
- **E2E (1 adet):** öğretmen olarak feedback butonu → dialog → gönder → başarı mesajı.
- Migration sonrası DB tipleri regenerate edilir (`database.types.ts`) — aksi halde tsc kırılır.

## Riskler

- `SECURITY DEFINER` fonksiyonda `search_path` sabitlenir (`set search_path = public`) — advisor bulgusu önleme.
- `/api/usage` auth'suz çağrılara 204 döner; public route listesine (proxy.ts kontrolü varsa) eklenmesi gerekir — plan aşamasında doğrulanacak.
