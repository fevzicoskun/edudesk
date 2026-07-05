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

> **Keşif (plan aşamasında):** Feedback UI ve action ZATEN VAR — `components/FeedbackButton.tsx`
> Sidebar'da "Öneri & Destek" olarak yaşıyor, `app/actions/feedback.ts` Resend ile `FEEDBACK_TO`'ya
> mail atıyor. Bu bölümün işi sıfırdan kurulum değil, **mevcut akışa kalıcı DB kaydı eklemek**.

### Veri modeli — `feedback`

```sql
create table feedback (
  id         uuid        primary key default gen_random_uuid(),
  school_id  uuid        not null references schools(id),
  user_id    uuid        not null,
  role       text        not null,
  page_path  text        not null,          -- gönderildiği sayfa, otomatik
  category   text        not null check (category in ('oneri', 'istek', 'sikayet')),
  message    text        not null check (char_length(message) between 3 and 2000),
  created_at timestamptz not null default now()
);
```

- Kategoriler mevcut UI'daki gibi: **öneri / istek / şikayet** (spec'in ilk taslağındaki
  oneri/hata/diger yerine — hata bildirimi zaten `error-report.ts` ile otomatik gidiyor).
- RLS: SELECT/UPDATE/DELETE policy yok — okuma yalnızca service-role (/platform).
- Yazım kullanıcı session'ı ile; INSERT policy: `user_id = auth.uid()` ve
  `school_id = current_school_id()` (mevcut helper).
- Dikkat: SELECT policy olmadığı için `.insert()` sonrası `.select()` ÇAĞRILMAZ (returning satır
  okuyamaz, sorgu patlar). Insert dönüşü kullanılmaz.

### Akış — mevcut action genişletilir

Mevcut `app/actions/feedback.ts` düz bir action (domain katmanı yok) — öyle kalır, domain
katmanı açmaya değmez (tek insert + mail). Değişiklikler:

1. Zod doğrulama eklenir (kategori enum + mesaj 3–2000 + page_path max 200).
2. Önce DB'ye INSERT (kullanıcı session client'ı) — asıl kalıcı kayıt bu.
3. Mail **best-effort**'a düşer: DB kaydı başarılıysa mail patlasa da `ok: true` döner
   (mevcut davranışta mail tek kanal olduğu için hata dönüyordu; artık değil).
4. Basit rate-limit: aynı kullanıcıdan son 1 dakikada 3+ kayıt varsa reddet — SELECT policy
   olmadığından bu kontrol service client ile yapılır (tek count sorgusu). Sınır 1 değil 3:
   spam'i yine keser, e2e tekrar koşularını ve art arda meşru gönderimleri kırmaz.

### UI — mevcut FeedbackButton'a küçük ek

- `components/FeedbackButton.tsx`'e `usePathname()` ile hidden `page_path` input'u eklenir.
- Kategori/dialog/başarı akışı olduğu gibi kalır.

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
- `/api/usage` public route listesine EKLENMEZ (plan kararı): auth'suz beacon proxy'de /login redirect'i yer, `sendBeacon` sonucu umursamadığı için istemci etkilenmez. Rate limit: genel 30/dk api bucket'ından muaf tutulur (okul IP'sinden yoğun beacon diğer API çağrılarını boğmasın), kendi `usage:` limiter'ı 120/dk fail-open çalışır.
