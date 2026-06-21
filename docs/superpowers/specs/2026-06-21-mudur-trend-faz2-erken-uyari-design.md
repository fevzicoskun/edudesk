# Müdür Trend Paneli — Faz 2: MY Erken Uyarı (Tasarım)

**Tarih:** 2026-06-21
**Durum:** Onaylandı, plana hazır
**Kapsam:** Faz 2'nin ilk parçası — müdür yardımcısı (MY) için trend-bazlı erken uyarı kartı. Okul karnesi PDF/Excel export ve proaktif bildirim (cron/push/e-posta) bu spec'in DIŞINDA, ayrı tura bırakıldı.

## Amaç

Faz 1 müdüre okul-geneli trend grafiklerini *gösteriyor* (devamsızlık / öğretmen aktivitesi / yoklama kapsama). Eksik olan: trend **bozulduğunda** operasyonel role (MY) proaktif sinyal. MY günlük operasyonu yürütür; "okul yukarı mı aşağı mı gidiyor" sorusunu grafiğe bakıp yorumlamak yerine, kötüleşen metrikler kendiliğinden öne çıkmalı.

Rol ayrımı (Faz 1 kararının devamı):
- **Müdür** → stratejik nabız: trend grafikleri (Faz 1).
- **Müdür yardımcısı** → operasyonel: erken uyarı (bu spec) + ileride evrak/export.

## Tespit yöntemi: dönem ortalamasından sapma

**Temel tanımlar:**
- **Son tam hafta**: Pazar günü bugünden önce bitmiş en son hafta. İçinde bulunulan (yarım) hafta HARİÇ — yarım hafta yanıltıcı düşük/yüksek değer verir.
- **Baz**: dönemde (`donemBasi()`'den bugüne), son-tam-haftadan önceki, veri olan haftalar.
- **Minimum baz**: en az 2 baz hafta. Yoksa trend uyarısı üretilmez; kart "Trend uyarıları için veri birikiyor" der (Faz 1 MIN_WEEKS mantığıyla tutarlı).

## Kurallar (varsayılan eşikler — `earlyWarning.ts`'te ayarlanabilir sabitler)

| # | Sinyal | Kural | Yön |
|---|---|---|---|
| 1 | Devamsızlık artışı | son hafta ≥ baz ortalaması **+3 puan** | yüksek = kötü |
| 2 | Yoklama kapsama düşüşü | son hafta ≤ baz ortalaması **−10 puan** | düşük = kötü |
| 3 | Öğretmen aktivite düşüşü | son hafta ≤ baz ortalaması **−15 puan** | düşük = kötü |
| 4 | Sınıf-bazlı bozulma | sınıf dönem devamsızlığı ≥ okul ortalaması **×1.5** VE ≥ **%10** mutlak taban | en kötü 1–3 sınıf |

- "Puan" = yüzde puanı (ör. %9 → %14 = +5 puan).
- Kural 1–3: zamanda sapma (son tam hafta vs baz ortalaması).
- Kural 4: sınıf-vs-okul sapması (anlık, dönem-toplamı). %10 mutlak taban, 2–3 kişilik sınıflarda tek devamsızın "fırlama" gibi görünmesini engeller.

**Şiddet (2 seviye, sapma büyüklüğünden türetilir):**
- Eşiği aşan → `dikkat` (amber).
- Eşiğin ~2 katını aşan → `yuksek` (kırmızı).
- Kart uyarıları şiddete göre sıralar (yüksek üstte).

**Boş durumlar:**
- Uyarı yok → yeşil "Tüm trendler stabil ✓".
- Yeterli baz hafta yok → nötr "Trend uyarıları için veri birikiyor".

## Mimari (Yaklaşım A — trend dizilerinden türet)

Faz 1 zaten okul-geneli haftalık trend dizilerini hesaplıyor; erken uyarı bu çıktıları **tüketir**. Yeni sorgu YOK, yeni migration YOK.

**Saf hesap (DB'siz, unit test edilebilir):** `src/domains/dashboard/lib/earlyWarning.ts`

```ts
export type EarlyWarning = {
  id: string                       // stabil React key, ör. 'absence-rise'
  severity: 'dikkat' | 'yuksek'
  metric: 'devamsizlik' | 'kapsama' | 'aktivite' | 'sinif'
  title: string                    // "Devamsızlık yükseliyor"
  detail: string                   // "Son hafta %14 · dönem ort. %9 (+5 puan)"
  classId?: string                 // metric==='sinif' için /siniflar/[id] linki
}

export function computeEarlyWarnings(
  absence: AbsenceTrendPoint[],
  activity: ActivityTrendPoint[],
  coverage: CoverageTrendPoint[],
  classAbsence: ClassAbsence[],
  now?: Date,
): EarlyWarning[]
```

Yardımcılar (aynı dosyada, tek yerde tutulur, 3 metrik için tekrar kullanılır):
- `lastCompleteWeek(points, now)` → içinde bulunulan haftayı atlayıp son tam haftanın noktasını döndürür (yoksa `null`).
- `baselineAvg(points, beforeWeekStart)` → baz haftaların ortalama oranı + dolu baz hafta sayısı; <2 ise yetersiz işaretler.

Eşikler dosya başında adlandırılmış sabitler:
```ts
const ABSENCE_RISE_PTS = 3
const COVERAGE_DROP_PTS = 10
const ACTIVITY_DROP_PTS = 15
const CLASS_MULTIPLIER = 1.5
const CLASS_FLOOR_PCT = 10
const MIN_BASELINE_WEEKS = 2
const SEVERITY_X = 2   // eşiğin bu katı → 'yuksek'
```
> Bu sabitler tahminî kalibrasyon; gerçek kullanımda ayarlanabilir.

**Server widget:** `app/(dashboard)/anasayfa/ErkenUyarilarWidget.tsx`
- `MudurTrendWidget` ile **aynı veri desenini** kullanır: `getAttendanceTrendRows / getHomeworkTrendRows / getTrendClasses / getSchoolTeachers` (hepsi `react.cache`'li, mevcut), pencere `donemBasi()`.
- Aynı `computeAbsenceTrend / computeActivityTrend / computeCoverageTrend / computeClassAbsence`'i çağırır (Faz 1 ile birebir aynı sayılar) → `computeEarlyWarnings` → kart.

**Yerleşim:** `app/(dashboard)/anasayfa/page.tsx` → `MYWidgets` içinde, `MYStatsWidget`'ın (anlık uyarılar) hemen altında (anlık → trend sıralaması). `WidgetErrorBoundary` + `Suspense` ile (mevcut desen). Yalnızca MY görür (müdür Faz 1 grafiklerini görür).

## UI

Mevcut `Card` stilinde:
- Başlık: **"Erken Uyarılar"**, alt başlık: "Son tamamlanan hafta · dönem ortalamasına göre".
- Her uyarı bir satır: şiddet noktası (amber/kırmızı) + başlık + detay (sayılar).
- `metric==='sinif'` uyarısı `/siniflar/[id]`'ye linklenir (mevcut desen).
- Boş/yetersiz durumlar yukarıdaki gibi.

## Test

`tests/vitest/unit/dashboard/early-warning.test.ts` — `computeEarlyWarnings` saf testleri:
- Her kural ayrı tetiklenir (devamsızlık +3 → uyarı; −2 → uyarı yok). Kapsama/aktivite düşüşü benzer.
- Son tam hafta seçimi: içinde bulunulan (yarım) hafta baz/son olarak KULLANILMAZ.
- <2 baz hafta → boş dizi (veri birikiyor).
- Şiddet: ~2× sapma → `yuksek`, eşik–2× arası → `dikkat`.
- Sınıf bozulma: ≥×1.5 ve ≥%10 → uyarı; %10 tabanın altı küçük örneklem → uyarı yok.

Widget ve UI test edilmez (sadece sunum + mevcut sorguların kompozisyonu).

## Kapsam dışı (sonraki turlar)

- Okul karnesi PDF/Excel export.
- Proaktif bildirim (haftalık cron → çan/push/e-posta).
- Alert geçmişinin DB'ye yazılması (`early_warnings` tablosu) — v1 anlık hesaplar.
- Ödev teslim oranı trendi (ödev verisi henüz olgunlaşmadı).
