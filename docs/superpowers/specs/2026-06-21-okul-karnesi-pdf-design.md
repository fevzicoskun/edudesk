# Okul Karnesi (PDF Export) — Tasarım

**Tarih:** 2026-06-21
**Durum:** Onaylandı, plana hazır
**Kapsam:** Faz 2'nin ikinci parçası — müdür/MY için indirilebilir PDF "okul karnesi". Proaktif bildirim (cron/push/e-posta) bu spec'in DIŞINDA, ayrı tura bırakıldı.

## Amaç

Müdür/MY, okulun dönem-geneli durumunu (devamsızlık, öğretmen aktivitesi, yoklama kapsama, sorunlu sınıflar, erken uyarılar) tek bir paylaşılabilir/yazdırılabilir PDF olarak indirebilsin. Faz 1 (trend grafikleri) ekranda gösteriyor; karne aynı veriyi dosyaya döker — üst yönetime sunum, arşiv, veli/zümre paylaşımı için.

## Format & yaklaşım kararları (kullanıcı)

- **Format: PDF** (yazdırılabilir/paylaşılabilir "karne"; Excel değil).
- **Mimari A: client-side jspdf + server action veri.** Projenin kanıtlanmış PDF deseni `src/lib/createPdf.ts` (`createDoc()` — gömülü Roboto fontu, Türkçe karakterleri doğru basar; `MatrisClient` bunu kullanır). Server-side jspdf font gömmeyi sıfırdan gerektirir (projede yok, riskli) → reddedildi.
- **İçerik:** 3 ana metrik özeti + sınıf karşılaştırması + erken uyarılar. (Öğretmen aktivite özeti kapsam dışı.)
- **Yerleşim & erişim:** `/yönetim` (Okul Durumu) sayfasında "Karne (PDF) indir" butonu; müdür + MY erişir.
- **Dönem aralığı:** `donemBasi()`'den bugüne (Faz 1/2 ile tutarlı).

## Veri katmanı

**Saf builder (DB'siz, unit test edilebilir):** `src/domains/dashboard/lib/karne.ts`

```ts
import type { EarlyWarning } from './earlyWarning'

export type KarneMetric = { sonHafta: number; donemOrt: number } // % (0-100)

export type KarneData = {
  schoolName: string
  donemStart: string   // 'yyyy-MM-dd'
  generatedAt: string  // ISO
  metrics: {
    devamsizlik: KarneMetric
    kapsama:     KarneMetric
    aktivite:    KarneMetric
  }
  classAbsence: { name: string; grade: number; rate: number }[] // worst-first, % (0-100)
  warnings: EarlyWarning[]
}

export function buildKarneData(
  schoolName: string,
  donemStart: string,
  absence: AbsenceTrendPoint[],
  activity: ActivityTrendPoint[],
  coverage: CoverageTrendPoint[],
  classAbsence: ClassAbsence[],
  now?: Date,
): KarneData
```

- Her metrik: **son tam hafta** (Faz 2 `selectTrendWindow`'un `last`'ı, % çevrili) + **dönem ortalaması** (real haftaların — `absence.total>0` olanların — rate ortalaması, % çevrili). Real hafta yoksa ikisi de `0`.
- `metrics.kapsama`/`aktivite` için "real hafta" göstergesi yine `absence.total>0` (Faz 2 ile tutarlı, tatil haftaları elenir).
- `warnings`: `computeEarlyWarnings(absence, activity, coverage, classAbsence, now)` çıktısı (Faz 2 reuse).
- `classAbsence`: `computeClassAbsence` çıktısının `rate`'i ×100, worst-first (zaten sıralı gelir).

**Server action:** `app/actions/karne.ts` → `getOkulKarnesi(): Promise<KarneData>`
- RBAC: `getCurrentProfile()` → `isMudurOrAbove(profile.role)` değilse `throw` (müdür + MY). `school_id` profilden.
- `ErkenUyarilarWidget`/`MudurTrendWidget` ile **aynı sorgular**: `getAttendanceTrendRows / getHomeworkTrendRows / getTrendClasses / getSchoolTeachers`, pencere `donemBasi()`.
- Trendleri hesapla (`computeAbsenceTrend / computeActivityTrend / computeCoverageTrend / computeClassAbsence`) → `buildKarneData(schoolName, donemStart, ...)` → döndür.
- Okul adı: `getCurrentProfile().schools?.name ?? 'Okul'` (mevcut desen).
- Hesap **tıklama anında** (sayfa yükünde değil).

## PDF üreticisi (client)

`app/(dashboard)/yonetim/karnePdf.ts` (`'use client'`) → `buildKarnePdf(data: KarneData): Promise<void>`
- `createDoc()` (mevcut helper, gömülü Roboto) + `jspdf-autotable`.
- Düzen:
  1. **Başlık:** okul adı, "Okul Karnesi", alt satır: dönem aralığı (`donemStart` – bugün) + üretim tarihi.
  2. **Metrik tablosu:** sütunlar `Metrik | Son hafta | Dönem ort.`; 3 satır (Devamsızlık / Öğretmen aktivitesi / Yoklama kapsama); değerler `%X`. (Veri 0 ise "—".)
  3. **Sınıf karşılaştırması tablosu:** `Sınıf | Devamsızlık %`, en kötüden; boşsa "Yoklama verisi yok".
  4. **Erken uyarılar:** her biri şiddet etiketi ([Yüksek]/[Dikkat]) + başlık + detay; boşsa "Aktif uyarı yok".
- `doc.save('okul-karnesi-<yyyy-MM-dd>.pdf')`.

## UI (buton)

`app/(dashboard)/yonetim/KarneIndirButton.tsx` (`'use client'`):
- "Karne (PDF) indir" butonu → `getOkulKarnesi()` → `buildKarnePdf()`.
- Yükleniyor durumu (`isPending`/disabled), hata → `useToast`.
- `/yönetim/page.tsx` başlık bölümüne yerleştirilir (müdür + MY zaten bu sayfada; action RBAC'ı ikinci savunma).

## Test

`tests/vitest/unit/dashboard/karne.test.ts` — `buildKarneData` saf testleri:
- 3 metrik `sonHafta` + `donemOrt` doğru türetiliyor (örnek trend dizileri; % çevrimi).
- `warnings` `computeEarlyWarnings` ile tutarlı (bozulma kuran dizide dolu).
- `classAbsence` %'ye çevrili ve worst-first sıralı.
- Boş/yetersiz veri → metrikler 0, diziler boş, çökme yok.

`karnePdf.ts` (jspdf/DOM) ve server action (DB) test edilmez — sunum + kompozisyon, mevcut `MatrisClient`/export deseni gibi.

## Kapsam dışı (sonraki tur)

- Proaktif bildirim (haftalık cron → çan/push/e-posta).
- Excel karne / öğretmen aktivite özeti bölümü.
- Karne geçmişinin saklanması (her indirme anlık üretilir, kalıcı dosya yok).
