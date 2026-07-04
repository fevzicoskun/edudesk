# Push Teşvik Şeridi — Tasarım

**Tarih:** 2026-07-04
**Durum:** Onaylandı
**Amaç:** Push aboneliği bugün yalnız `/ayarlar`'daki `WebPushButton`'da gömülü — çoğu kullanıcı oraya hiç gitmiyor, bu yüzden Günlük Özet (07:30 cron) telefonlara düşmüyor. Dashboard'a nazik bir teşvik şeridi ekleyerek push abonelik oranını artırmak (retention #3).

## Karar Özeti (kullanıcı onaylı)

| Soru | Karar |
|---|---|
| Kitle/yerleşim | TÜM roller — `app/(dashboard)/layout.tsx` içinde `<main>`'de `{children}` üstü (tek bileşen, tek yerleşim) |
| Erteleme | "Daha sonra" → 14 gün sus (localStorage zaman damgası); abone olununca/izin reddedilince kalıcı görünmez |

## Davranış

Şerit içeriği: `🔔 Sabah özetini ve bildirimleri telefonuna al` + **"Bildirimleri aç"** (primary) + **"Daha sonra"** (kapat).

Görünürlük — HEPSİ sağlanmalı:
1. Tarayıcı destekliyor (`serviceWorker` + `PushManager`) VE `NEXT_PUBLIC_VAPID_PUBLIC_KEY` tanımlı (yoksa hiç render edilmez — WebPushButton `unsupported` deseni)
2. `Notification.permission !== 'denied'`
3. Aktif push aboneliği YOK (`pushManager.getSubscription()` null)
4. Snooze dolmuş: `shouldShowPushNudge(localStorage[NUDGE_STORAGE_KEY])` true

Akışlar:
- **"Bildirimleri aç"** → mevcut subscribe akışı (SW register → `Notification.requestPermission()` → `pushManager.subscribe` → `POST /api/push/subscribe`). Başarıda kısa "Bildirimler açıldı ✓" gösterip kaybolur. İzin reddedilirse şerit kaybolur (permission='denied' artık kalıcı). Hata olursa şerit kalır, buton normale döner, `console.error` (WebPushButton ile aynı).
- **"Daha sonra"** → `localStorage[NUDGE_STORAGE_KEY] = new Date().toISOString()`, şerit anında gizlenir; 14 gün sonra tekrar görünür.
- İlk boyamada gizli başlar (görünürlük kontrolü mount-sonrası async) → CLS/e2e etkisi minimum.
- localStorage erişilemezse (gizli mod vb.) snooze kaydedilemez → her seferinde görünür; zararsız, kabul.

## Mimari

**Saf mantık (TDD):** `src/domains/dashboard/lib/pushNudge.ts` (`firstRun.ts` deseni)
- `NUDGE_SNOOZE_DAYS = 14`
- `NUDGE_STORAGE_KEY = 'edudesk-push-nudge-dismissed-at'`
- `shouldShowPushNudge(dismissedAtISO: string | null, now?: Date): boolean` — null/bozuk değer → true; damga < 14 gün önce → false; ≥ 14 gün → true.

**Ortak abonelik hook'u (DRY):** `app/(dashboard)/usePushSubscription.ts`
- `WebPushButton.tsx`'teki durum makinesi (`unsupported | loading | denied | subscribed | unsubscribed`) + `subscribe()` + `unsubscribe()` buraya çıkarılır.
- `WebPushButton` hook'u kullanacak şekilde sadeleşir — görünür davranışı BİREBİR korunur (aynı state'ler, aynı metinler, aynı fetch çağrıları).
- Yeni şerit de aynı hook'u kullanır (unsubscribe'ı kullanmaz).

**Bileşen:** `app/(dashboard)/PushTesvikSeridi.tsx` ('use client')
- Hook state'i `unsubscribed` + `shouldShowPushNudge` true → görünür; diğer tüm durumlarda `null` döner.
- Görsel: mevcut kart dili (`bg-white dark:bg-slate-800 border ... rounded-xl`), kompakt tek satır (mobilde sarabilir); soluk metin `text-gray-500 dark:text-slate-400` (WCAG kuralı, asla text-gray-400); "Daha sonra" butonu `aria-label`'lı.

**Yerleşim:** `app/(dashboard)/layout.tsx` — `<main>` içinde `{children}`'dan hemen önce `<PushTesvikSeridi />`. Server layout'a client bileşen gömmek serbest.

**Migration YOK. Yeni tablo YOK. Yeni bağımlılık YOK. API değişikliği YOK.**

## Test

- `tests/vitest/unit/domains/dashboard/pushNudge.test.ts`: null → true; bozuk string → true; 13 gün önce → false; 15 gün önce → true; tam sınır (14 gün) → true.
- Hook + bileşen unit-test dışı (repo deseni: tarayıcı-API'li client bileşenler e2e/manuel doğrulanır).
- Mevcut 67 e2e: şerit ilk boyamada yok (async kontrol) → kırılma riski düşük. Kırılan olursa kırılan spec'in seçicisi daraltılır, şerit gizlenmeye çalışılmaz.
- Manuel smoke: dev'de şerit görünür → "Bildirimleri aç" → tarayıcı izni → "açıldı ✓" → yenileyince şerit yok; "Daha sonra" → yenileyince yok.

## Bilinçli Dışarıda (sonraki iterasyonlar)

- iOS "ana ekrana ekle" yönlendirmesi (iOS'ta web push yalnız kurulu PWA'da çalışır — ayrı, daha büyük iş)
- Abonelik oranı ölçümü/analitik
- Role özel metinler
