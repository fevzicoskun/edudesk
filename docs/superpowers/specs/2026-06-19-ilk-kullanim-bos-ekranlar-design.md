# İlk-kullanım & Boş Ekranlar — Tasarım

Tarih: 2026-06-19
Yaklaşım: A (paylaşılan bileşen + rol-bazlı ilk-adımlar), geniş kapsam

## Amaç

Yeni kayıt olan bir okulun/öğretmenin sıfır veriyle karşılaştığı ekranları
"kırık/boş" hissinden çıkarıp yönlendirici hale getirmek. Bu yüzey günlük
kullanıcının (dolu veriyle çalışan) hiç görmediği, ama satış demosunun ilk
izlenimini belirleyen yer.

## Problem (mevcut durum)

- `odevler/EmptyState.tsx` zaten zengin: ikon + başlık + yardım metni + CTA +
  dark mode + "veri yok" vs "filtre eşleşmedi" ayrımı. **Altın standart.**
- Sayfa-düzeyi diğer boşluklar çıplak tek gri cümle:
  - `siniflar/page.tsx` → "Henüz sınıf eklenmemiş."
  - `yoklama/cizelge/page.tsx` → "Henüz sınıf eklenmemiş."
  - `yonetim/ogrenciler` → sıfır öğrenci için gerçek boş hali yok (yalnız
    arama sonucu "Sonuç bulunamadı" var).
- Dashboard'da yeni hesap için birleşik bir "şuradan başla" yönlendirmesi yok;
  yalnız dağınık küçük widget boşlukları var.

Tarama sonucu ~35 boş-ekran mesajı iki kategoriye ayrılıyor:
1. **Inline (bileşen-içi):** arama sonucu, takvim hücresi, "Riskli öğrenci yok"
   gibi — bunlar doğru, dokunulmayacak.
2. **Sayfa-düzeyi / ilk-kullanım:** tüm sayfa boş, yönlendirme gereken yerler —
   bu tasarımın hedefi.

## Çözüm

### 1. Paylaşılan `<EmptyState>` bileşeni

Yeni dosya: `app/components/EmptyState.tsx`

```tsx
interface EmptyStateAction { label: string; href: string }

interface EmptyStateProps {
  icon?: React.ReactNode            // verilmezse varsayılan kutu/ikon
  title: string
  description?: string
  action?: EmptyStateAction         // birincil CTA (mavi gradient buton)
  secondaryAction?: EmptyStateAction // ikincil CTA (nötr çerçeveli buton)
}
```

- Görsel dil `odevler/EmptyState.tsx`'ten birebir taşınır (ikon kutusu 16x16,
  başlık `font-semibold`, açıklama `max-w-xs`, gradient birincil buton).
- `action` verilmezse buton render edilmez (öğretmenin sınıf açamadığı durum).

`odevler/EmptyState.tsx` refactor edilir: kendi içinde yeni paylaşılan bileşeni
çağırır (hasFilters/canWrite mantığı orada kalır, sadece görsel gövde paylaşılır).
Böylece mevcut çağıranlar (`odevler/page.tsx`) kırılmaz.

### 2. Sayfa-düzeyi boşluklar → `EmptyState`

| Dosya | Koşul | Başlık | CTA |
|---|---|---|---|
| `siniflar/page.tsx` | 0 sınıf | "Henüz sınıf yok" | müdür/MY: yok (üstte ekleme formu var, açıklama oraya yönlendirir); öğretmen: yok |
| `yoklama/cizelge/page.tsx` | 0 sınıf | "Henüz sınıf yok" | müdür/MY: "Sınıf ekle" → `/siniflar`; öğretmen: yok |
| `yonetim/ogrenciler` (page.tsx) | 0 öğrenci | "Henüz öğrenci yok" | "Öğrenci ekle/içe aktar" → mevcut ekleme akışı |

`siniflar`'da müdür/MY zaten sayfa üstündeki inline formu görüyor; EmptyState
açıklaması "Yukarıdaki formdan ilk sınıfını ekle" der, ayrı CTA gerekmez.

### 3. Dashboard ilk-adımlar bloğu

Yeni dosya: `app/(dashboard)/anasayfa/IlkAdimlarWidget.tsx`

Rol-bazlı iki varyant:

- **Kurulum (müdür / müdür_yardımcısı, okulda 0 sınıf):** 3 adımlık yönlendirme
  kartı.
  1. Sınıf ekle → `/siniflar`
  2. Öğrenci ekle → `/yonetim/ogrenciler`
  3. Öğretmen davet et → `/kullanicilar`
  Her adım linkli; tamamlanma işareti YOK (YAGNI — sadece yönlendirme).
- **Bekleme (öğretmen, atanmış 0 sınıf):** pasif `EmptyState`,
  "Henüz sana sınıf atanmadı. Müdürün sınıf atadığında burada görünecek." CTA yok.

#### Yerleştirme

- `OgretmenDashboard.tsx`: `hasClasses` (= `metrics.yoklamaDurumu.length > 0`)
  zaten hesaplı. `false` ise selamlamanın hemen altında "bekleme" varyantı
  gösterilir; mevcut dağınık boş widget'lar bu durumda render edilmez (erken
  return ile sade ekran).
- `page.tsx` içindeki `MudurWidgets` / `MYWidgets`: okulun sınıf sayısı 0 ise
  selamlamanın altında "kurulum" varyantı gösterilir. Sınıf sayısı için hafif
  bir `count` sorgusu (`classes` tablosu, `school_id`, `deleted_at is null`,
  `head: true, count: 'exact'`).

#### Karar helper'ı (saf fonksiyon)

Yeni dosya: `src/domains/dashboard/lib/firstRun.ts`

```ts
type Role = 'ogretmen' | 'zumre_baskani' | 'mudur_yardimcisi' | 'mudur' | 'admin'

export function firstRunState(role: Role, classCount: number):
  'setup' | 'waiting' | null {
  if (classCount > 0) return null
  if (role === 'mudur' || role === 'mudur_yardimcisi') return 'setup'
  return 'waiting' // ogretmen, zumre_baskani, admin
}
```

Not: `admin` `page.tsx`'te öğretmen dashboard rotasına düşer (müdür değil), bu
yüzden 'waiting' döner — yerleşimle tutarlı. Admin platform-düzeyi roldür,
pratikte bu okul-dashboard akışına girmez.

`IlkAdimlarWidget` bu helper'ın döndürdüğü değere göre varyant seçer.

## Test

- `EmptyState` ve `IlkAdimlarWidget` sunumsaldır → birim test gerekmez.
- `firstRunState` saf karar fonksiyonu → tek test dosyası:
  `tests/vitest/unit/domains/dashboard/firstRun.test.ts`
  - classCount > 0 → null (her rol)
  - müdür/MY + 0 sınıf → 'setup'
  - öğretmen/zümre başkanı/admin + 0 sınıf → 'waiting'

## Kapsam dışı (bilinçli)

- Inline boşluklar (arama "Sonuç bulunamadı", takvim hücresi "Bu gün ödev yok",
  "Riskli öğrenci yok. Her şey yolunda!" vb.) — bağlamlarında doğru, değişmez.
- Onboarding sihirbazı/tur — `app/onboarding` zaten var, YAGNI.
- Adım tamamlanma takibi / kalıcı "kurulum ilerlemesi" durumu — YAGNI.

## Değişen/eklenen dosyalar

| Dosya | İşlem |
|---|---|
| `app/components/EmptyState.tsx` | yeni (paylaşılan) |
| `app/(dashboard)/odevler/EmptyState.tsx` | refactor → paylaşılanı kullan |
| `app/(dashboard)/siniflar/page.tsx` | boş hali → EmptyState |
| `app/(dashboard)/yoklama/cizelge/page.tsx` | boş hali → EmptyState |
| `app/(dashboard)/yonetim/ogrenciler/page.tsx` | 0 öğrenci → EmptyState |
| `app/(dashboard)/anasayfa/IlkAdimlarWidget.tsx` | yeni |
| `app/(dashboard)/anasayfa/OgretmenDashboard.tsx` | bekleme varyantı bağla |
| `app/(dashboard)/anasayfa/page.tsx` | müdür/MY kurulum varyantı + sınıf count |
| `src/domains/dashboard/lib/firstRun.ts` | yeni (saf helper) |
| `tests/vitest/unit/domains/dashboard/firstRun.test.ts` | yeni test |
