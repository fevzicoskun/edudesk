# Abonelik & Manuel Ödeme (v1) — Tasarım

**Tarih:** 2026-07-09
**Karar bağlamı:** Stripe Türkiye'ye kapalı; 2 okul varken otomatik tahsilat (iyzico) YAGNI.
Tahsilat banka havalesiyle manuel yürür; uygulama abonelik dönemini, ödeme kaydını ve
erişim enforcement'ını yönetir. iyzico 10-20+ okula gelince ayrı iş olarak eklenir.

## Problem

`schools.status/plan/trial_ends_at/suspended_*` kolonları var ve /platform panelinden
yönetiliyor, ama **yalnızca etiket**: dashboard, proxy veya auth katmanında hiçbir
enforcement yok. Askıya alınan okul uygulamayı aynen kullanıyor; trial bitişi hiçbir şey
tetiklemiyor. `NewSchoolModal` trial seçtiriyor ama `trial_ends_at` set etmiyor.
Ödeme kaydı tutacak tablo yok.

## Kararlar (kullanıcı onaylı)

1. **Kapsam:** Manuel havale + enforcement. iyzico yok.
2. **Enforcement şekli:** Kademeli — bitişe ≤14 gün kala müdür/MY'ye uyarı bandı;
   süre dolunca tüm okul kullanıcıları kilit sayfasına yönlenir (login çalışır, veri silinmez).
3. **Dönem:** Esnek aralık — her ödeme kaydına başlangıç/bitiş girilir (ay, 6 ay, eğitim
   yılı, ne anlaşıldıysa). Tek mekanizma: "en son bitiş > bugün mü?"
4. **Plan gating yok:** `plan` kolonu bilgi etiketi olarak kalır; tüm aboneler her özelliği
   kullanır.

## 1. Karar modeli

`schools` tablosuna tek kolon: **`access_until date NULL`**.

- `null` = süresiz erişim → mevcut davranış birebir korunur (bugünkü okullar etkilenmez;
  platform admin tarih girene kadar hiçbir şey değişmez).
- Trial okul: `access_until` = trial bitişi. `NewSchoolModal` ve `StatusToggle` trial
  seçiminde bu kolonu da yazar (trial süresi form alanı; `trial_ends_at` ile senkron
  tutulur — `trial_ends_at` yalnız gösterim içindir).
- Ödemeli okul: ödeme kaydı eklenince action `access_until = max(mevcut, period_end)`
  günceller. Runtime'da payments sorgusu yapılmaz — enforcement tek kolona bakar.

Saf fonksiyon `src/domains/billing/subscriptionMath.ts` (calendarMath/dutyMath deseni):

```
subscriptionState(
  { status, access_until }: { status: string; access_until: string | null },
  today: string,            // İstanbul-günü ISO (todayLocalISO deseni)
): 'suspended' | 'expired' | 'expiring' | 'active'
```

Öncelik sırası:
1. `status ∈ {suspended, cancelled}` → `'suspended'`
2. `access_until != null && access_until < today` → `'expired'`
3. `access_until != null && access_until ≤ today+14gün` → `'expiring'`
4. aksi halde `'active'`

Sınır semantiği: `access_until` **dahil** son erişim günüdür (o gün açık, ertesi gün kilit).

Cron yok — durum her istekte hesaplanır. `status` kolonu elle yönetilmeye devam eder:
askıya alma (bilinçli, anında) ile süre dolması (otomatik) ayrı kavramlardır.

## 2. Veri modeli — `school_payments`

```sql
create table school_payments (
  id            uuid primary key default gen_random_uuid(),
  school_id     uuid not null references schools(id),
  amount_kurus  integer not null check (amount_kurus > 0),  -- para = kuruş int, float YASAK
  paid_at       date not null,
  period_start  date not null,
  period_end    date not null check (period_end >= period_start),
  note          text,
  created_by    uuid not null,
  created_at    timestamptz not null default now()
);
alter table school_payments enable row level security;
-- Policy YOK (usage_daily deseni): tüm erişim /platform service-client action'ından,
-- platform_admins guard'lı. Advisor 0008 INFO bilinçli kabul.
```

Silme yok (v1): yanlış kayıt platform admin tarafından SQL ile düzeltilir — muhasebe
kaydında soft-delete karmaşası YAGNI. Migration sonrası DB tipleri regen (kalıcı ders).

## 3. Platform paneli — ödeme yönetimi

/platform okul satırına "Ödemeler" butonu → modal:
- Geçmiş ödeme listesi (tarih, tutar, dönem, not).
- Yeni kayıt formu: tutar (TL girilir, kuruşa çevrilir), ödeme tarihi, dönem başı/sonu, not.
  Zod validasyonu action boundary'de.
- Kayıt eklenince aynı action `schools.access_until` günceller + `revalidatePath('/platform')`.

`NewSchoolModal`: status=trial seçilince trial bitiş tarihi alanı zorunlu olur →
`trial_ends_at` + `access_until` birlikte yazılır. `StatusToggle` trial'a çekişte de aynısı.

## 4. Enforcement — iki katman

**Birincil (UI, dashboard layout):** layout zaten her istekte `getCurrentProfile()`
çağırıyor ve `schools` join'i var — `status/access_until` aynı join'e eklenir (sıfır ek
sorgu). `subscriptionState` `expired|suspended` dönerse `redirect('/abonelik-gerekli')`.

**Kilit sayfası `/abonelik-gerekli`:** login'li, dashboard layout DIŞInda (kilitli okul
sidebar görmez). İçerik: okul adı + "aboneliğiniz sona erdi". Müdür/MY'ye: ödeme/iletişim
yönlendirmesi ("bize ulaşın" — IBAN koda gömülmez). Öğretmene: "okul yöneticinizle
görüşün". Çıkış yap butonu. Okul aboneliği yenilenince (access_until güncellenince)
kullanıcılar kendiliğinden normale döner — ekstra akış yok.

**İkincil (yazma, requireAbility):** `requireAbility()` zaten profile okuyor — aynı
veriden `expired|suspended` ise hata fırlatır. Soft-navigation ile layout redirect'ini
atlayan aktif oturum da mutation yapamaz. Okuma server component'leri layout'un arkasında
olduğundan ayrı guard istemez.

**Uyarı bandı:** `expiring` durumunda dashboard'da müdür/MY'ye amber bant —
"Aboneliğiniz X gün sonra sona erecek" (PushTesvikSeridi deseni, layout'a eklenir).
Öğretmenler görmez. Snooze yok (tahsilat baskısı bilinçli).

**Kapsam dışı (v1, bilinçli):**
- `/veli/[token]` public sayfası açık kalır (okuma zararsız).
- E-posta/push bildirimi yok — yalnız uygulama-içi bant.
- Platform admin (/platform) enforcement'tan muaf (zaten ayrı guard).
- 14 gün eşiği sabit, config yok.

## 5. Hata yönetimi

- Layout join'i `schools` getiremezse (beklenmedik): enforcement **fail-open** —
  kullanıcıyı kilitlemek yerine geçir + `logger.error`. Tahsilat baskısı güvenlik
  sınırı değildir; yanlış-pozitif kilit (para ödemiş okulu dışarıda bırakmak) yanlış-negatiften
  (süresi geçmişin 1 istek daha atması) pahalıdır.
- Ödeme kaydı + `access_until` güncellemesi tek action içinde ardışık; ikincisi
  başarısızsa action hata döner ve admin panelde görünür (kayıt duruyor, tarih elle
  düzeltilebilir — iki tablo tek transaction'a alınacak kadar kritik değil, v1).

## 6. Test

- **Unit (TDD):** `subscriptionMath` — null access_until, tam bugün biten (dahil),
  yarın biten, 14. gün sınırı, suspended > expired önceliği, cancelled.
- **E2E:** (1) expired okul kullanıcısı → `/abonelik-gerekli`; (2) expiring okul müdürü
  → bant görünür, öğretmen görmez; (3) normal okul → hiçbir değişiklik (regresyon).
  Seed: e2e test okullarının `access_until`'u null kalır ki mevcut 72 test etkilenmesin.
- **Canlı doğrulama:** iki katman — DB'de `access_until`/payments satırı (SQL) + UI'da
  kilit/bant (tarayıcı).

## Başarı kriteri

Platform admin bir okula ödeme kaydı girip dönem uzatabiliyor; süresi dolan okul
kilit sayfasına düşüyor; bitişe 14 gün kala müdür bant görüyor; mevcut okullar ve
72 e2e hiç etkilenmiyor.
