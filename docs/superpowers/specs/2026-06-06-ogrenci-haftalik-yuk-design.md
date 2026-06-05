# Öğrenci Haftalık Yük Göstergesi — Tasarım Dokümanı

**Tarih:** 2026-06-06  
**Durum:** Onaylandı  

---

## Problem

Bir öğrencinin bu haftaki toplam ödev yükü, öğretmenin günlük iş akışında hiçbir yerde görünmüyor. Öğretmen ödev oluştururken sınıf bazında haftalık yük uyarısı alıyor (WeekLoadBanner), ancak StatusBoard'da öğrenci durumu girerken, ya da öğrenci profil modalını açarken, o öğrencinin kaç ödevinin olduğunu bilmiyor. Bu bilgi; geç/yapmama durumlarını yorumlamak, veliye açıklama yapmak ve yük dengesini sağlamak için kritik bağlamdır.

---

## Temel Tasarım Kararları

| Karar | Seçim | Gerekçe |
|-------|-------|---------|
| Öğrenci yükü nasıl hesaplanır? | Sınıfın haftalık yükü = öğrencinin yükü | Türk okullarında tüm öğrenciler aynı sınıftan ödev alır |
| Amber/kırmızı eşikler | 3+ amber, 5+ kırmızı | WeekLoadBanner ile tutarlılık; öğretmen aynı sayıları öğrendi |
| StatusBoard UI | Rozet + tıklanabilir popover | Sadelik + detay dengesi; sütun çok gürültülü, sade sayı çok kör |
| Veri yükleme yöntemi | Server-side `page.tsx`'te tek fetch | Client-side her öğrenci için ayrı fetch yerine N+1 önleme |

---

## Mimari

### Veri Akışı

```
page.tsx
  └── getClassWeekLoad([hw.class_id], hw.due_date)   ← zaten var, reuse
        └── ClassWeekLoad                             ← prop olarak geçilir
              ├── StatusBoard
              │     └── WeekLoadBadge (yeni inline bileşen)
              │           └── WeekLoadPopover (yeni inline bileşen)
              └── StudentHomeworkProfileModal
                    └── "Bu Hafta" özet satırı
```

`WeekLoadBanner` (HomeworkForm'da) için sadece metin değişikliği — ayrı veri akışı yok.

### Reuse edilen kod

- `ClassWeekLoad` tipi — `src/domains/homework/lib/week-load.ts`
- `getClassWeekLoad` server action — `app/actions/homework.ts`
- `buildClassWeekLoad` saf fonksiyon — aynı dosya

**Yeni dosya yok. Yeni DB tablosu/sorgusu yok.**

---

## Özellik Detayları

### 1. StatusBoard — Rozet + Popover

**Prop eklentisi:**
```typescript
weekLoad?: ClassWeekLoad | null
```

**Rozet görünümü** (her öğrenci satırının isim kolonunda):
- `count === 0` → rozet yok
- `level === 'ok'` → gri rozet `● 2`
- `level === 'warn'` → amber rozet `● 3`  
- `level === 'danger'` → kırmızı rozet `● 5`

**Popover içeriği** (tıklayınca açılır, dışarı tıklayınca kapanır):
```
Bu hafta 4 ödev:
• Matematik alıştırmaları — Cuma  ★ (senin ödevi)
• Türkçe okuma — Perşembe
• Fen deneyi — Cuma (Murat Bey)
• İngilizce kelimeler — Cuma (Lisa Hanım)
```
- Senin ödevi `★` ile işaretlenir (`isOwn: true`)
- Başka öğretmenin ödevi: öğretmen adı parantezde
- Öğrencinin ID'si popover'a **dahil değil** (güvenlik: başka öğretmenin ödevine navigate edilemez)
- Mobilde popover kapatma için backdrop overlay

**Önemli:** Tüm öğrenciler aynı `weekLoad` datasını kullanır — popover içeriği sınıf bazında, öğrenciye özel değil.

### 2. StudentHomeworkProfileModal — "Bu Hafta" Özet Satırı

**Prop eklentisi:**
```typescript
weekLoad?: ClassWeekLoad | null
```

Modal başlığının (öğrenci adı) hemen altına:
- `weekLoad` yoksa veya `count === 0` → satır gösterilmez
- Yoksa: `Bu hafta: ● 4 ödev` (level renginde badge)

Detay listesi modal içinde ayrıca gösterilmez — sadece özet sayı.

### 3. HomeworkForm WeekLoadBanner — Öngörülü Metin

**Prop eklentisi:**
```typescript
isCreating?: boolean   // default: false
```

Mevcut davranış: Banner `count` değerini DB'deki mevcut ödevleri sayarak gösterir.  
Yeni davranış (`isCreating=true`): `count + 1` gösterilir, metin "Bu ödev dahil X ödev olacak" olur. Seviye (`level`) hesabı da `count + 1` üzerinden yapılır.

Örnek: Sınıfta bu hafta 2 ödev varsa, oluşturma formunda "Bu ödev dahil 3 ödev olacak" görünür.

`isCreating` prop'u yalnızca `HomeworkForm`'dan geçirilir. `OdevDuzenleForm`'da geçirilmez — düzenleme senaryosunda ödev zaten DB'de mevcut, öngörü gereksiz.

---

## Dosya Haritası

| Dosya | İşlem | Detay |
|-------|-------|-------|
| `app/(dashboard)/odevler/[id]/page.tsx` | Değiştir | `getClassWeekLoad` çağrısı + `weekLoad` prop'u iletimi |
| `app/(dashboard)/odevler/[id]/StatusBoard.tsx` | Değiştir | `weekLoad` prop + `WeekLoadBadge` + `WeekLoadPopover` inline bileşenler |
| `app/(dashboard)/odevler/[id]/StudentHomeworkProfileModal.tsx` | Değiştir | `weekLoad` prop + "Bu Hafta" satırı |
| `app/(dashboard)/odevler/yeni/HomeworkForm.tsx` | Değiştir | `WeekLoadBanner`'a `isCreating` prop + metin değişikliği |

---

## Hata / Sınır Durumları

- `hw.due_date` null ise → `getClassWeekLoad` çağrılmaz, `weekLoad = null`, rozet gösterilmez
- `getClassWeekLoad` hata dönerse → `weekLoad = null`, sessizce geçilir (rozet yok)
- Sınıfta hiç öğrenci yoksa → zaten StatusBoard öğrenci olmadığını söylüyor
- `count === 1` ve o tek ödev mevcut ödev ise → `level === 'ok'`, rozet gösterilmez (gereksiz gürültü önlenir)

---

## Test Stratejisi

- **Unit:** `WeekLoadBadge` bileşeninin level → renk/metin eşlemesi (3 test)
- **Unit:** `WeekLoadBanner` öngörülü metin (`isCreating=true`, `isCreating=false`) (2 test)
- **Manuel:** StatusBoard'da rozet görünür, popover açılır/kapanır, mobil backdrop çalışır

---

## Kapsam Dışı (V1)

- Öğrenci özelinde farklı yük eşiği (farklı kademe için — ileriki sprint)
- Velinin portalda öğrencisinin yükünü görmesi (ayrı özellik)
- Öğrenciye push bildirim ("bu hafta 5 ödevin var")
