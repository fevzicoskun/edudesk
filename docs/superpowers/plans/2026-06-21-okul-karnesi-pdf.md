# Okul Karnesi (PDF Export) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Müdür/MY'nin `/yönetim` sayfasından okulun dönem-geneli durumunu (3 metrik + sınıf karşılaştırması + erken uyarılar) indirilebilir PDF "karne" olarak almasını sağlamak.

**Architecture:** Saf `buildKarneData` (Faz 1/2 trend dizilerini KarneData'ya çevirir) → server action `getOkulKarnesi` (RBAC + mevcut sorgular + trend hesapları) → client `buildKarnePdf` (mevcut `createDoc`/Roboto + jspdf-autotable) → `/yönetim`'de "Karne (PDF) indir" butonu.

**Tech Stack:** Next.js App Router (server action + client component), TypeScript, jspdf@4 + jspdf-autotable@5 (`src/lib/createPdf.ts`), Vitest.

## Global Constraints

- `rate` alanları KESİR (0–1); karne metrikleri %'ye çevrilir (`Math.round(rate*100)`).
- "Son tam hafta" = içinde bulunulan (yarım) hafta hariç; "real hafta" = `absence.total>0` (tatil elenir) — Faz 2 ile aynı.
- Pencere `donemBasi()`; tüm trend dizileri aynı hafta kümesi.
- PDF Türkçe için `createDoc()` (gömülü Roboto) kullan — düz `new jsPDF()` DEĞİL.
- RBAC: karne yalnız `isMudurOrAbove(role)` (müdür + MY).
- Test: `npm run test:unit -- <dosya>`. tsc: `npx --no-install tsc --noEmit 2>&1 | grep -i <dosya> | grep -v "EduDesk-Architecture\|migration-cleanup"`.
- Commit Türkçe + `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. `EduDesk-Architecture/`, `migration-cleanup/`'a dokunma. Push etme (kontrolör en sonda).

---

## File Structure

- Modify: `src/domains/dashboard/lib/earlyWarning.ts` — `currentWeekStart`'ı export et (Task 1).
- Create: `src/domains/dashboard/lib/karne.ts` — `KarneData` tipi + saf `buildKarneData` (Task 1).
- Create: `tests/vitest/unit/dashboard/karne.test.ts` (Task 1).
- Create: `app/actions/karne.ts` — server action `getOkulKarnesi` (Task 2).
- Create: `app/(dashboard)/yonetim/karnePdf.ts` — client `buildKarnePdf` (Task 3).
- Create: `app/(dashboard)/yonetim/KarneIndirButton.tsx` — client buton (Task 4).
- Modify: `app/(dashboard)/yonetim/page.tsx` — butonu başlığa ekle (Task 4).

Tüketilen mevcut parçalar:
- `src/domains/dashboard/lib/earlyWarning.ts`: `computeEarlyWarnings`, `EarlyWarning`, `currentWeekStart` (Task 1'de export edilecek).
- `src/domains/dashboard/lib/trendMath.ts`: `computeAbsenceTrend/ActivityTrend/CoverageTrend/ClassAbsence` + tipleri `AbsenceTrendPoint/ActivityTrendPoint/CoverageTrendPoint/ClassAbsence`.
- `src/domains/dashboard/queries/schoolTrends.ts`: `getAttendanceTrendRows/getHomeworkTrendRows/getTrendClasses`. `schoolStats.ts`: `getSchoolTeachers`.
- `@/src/shared/utils`: `donemBasi`. `@/src/shared/auth`: `getCurrentProfile`. `@/src/shared/types`: `isMudurOrAbove`.
- `src/lib/createPdf.ts`: `createDoc()` → `PdfDoc`.

---

### Task 1: `buildKarneData` saf fonksiyonu + tipler

**Files:**
- Modify: `src/domains/dashboard/lib/earlyWarning.ts` (currentWeekStart export)
- Create: `src/domains/dashboard/lib/karne.ts`
- Test: `tests/vitest/unit/dashboard/karne.test.ts`

**Interfaces:**
- Consumes: `currentWeekStart(now)`, `computeEarlyWarnings`, `EarlyWarning` (earlyWarning.ts); trendMath tipleri.
- Produces:
  - `type KarneMetric = { sonHafta: number; donemOrt: number }`
  - `type KarneData = { schoolName: string; donemStart: string; generatedAt: string; metrics: { devamsizlik: KarneMetric; kapsama: KarneMetric; aktivite: KarneMetric }; classAbsence: { name: string; grade: number; rate: number }[]; warnings: EarlyWarning[] }`
  - `buildKarneData(schoolName, donemStart, absence, activity, coverage, classAbsence, now?): KarneData`

- [ ] **Step 1: earlyWarning.ts'te currentWeekStart'ı export et**

`src/domains/dashboard/lib/earlyWarning.ts` içinde:
```ts
function currentWeekStart(now: Date): string {
```
satırını şu hale getir:
```ts
export function currentWeekStart(now: Date): string {
```
(Başka değişiklik yok.)

- [ ] **Step 2: Write the failing test**

`tests/vitest/unit/dashboard/karne.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { buildKarneData } from '@/src/domains/dashboard/lib/karne'
import type {
  AbsenceTrendPoint, ActivityTrendPoint, CoverageTrendPoint, ClassAbsence,
} from '@/src/domains/dashboard/lib/trendMath'

const WS = ['2026-05-04', '2026-05-11', '2026-05-18', '2026-05-25']
const NOW = new Date('2026-06-01T12:00:00') // 4 hafta da tam & real

const abs = (r: number[]): AbsenceTrendPoint[] =>
  WS.map((weekStart, i) => ({ weekStart, label: weekStart, rate: r[i], absent: 1, total: 10 }))
const act = (r: number[]): ActivityTrendPoint[] =>
  WS.map((weekStart, i) => ({ weekStart, label: weekStart, rate: r[i], active: 1, total: 4 }))
const cov = (r: number[]): CoverageTrendPoint[] =>
  WS.map((weekStart, i) => ({ weekStart, label: weekStart, rate: r[i], recorded: 9, expected: 10 }))
const cls = (classId: string, name: string, rate: number): ClassAbsence =>
  ({ classId, name, grade: 9, rate, absent: Math.round(rate * 100), total: 100 })

describe('buildKarneData', () => {
  it('metrikleri son hafta + dönem ortalaması olarak %-çevirir', () => {
    const k = buildKarneData(
      'Test Okulu', '2026-02-01',
      abs([0.10, 0.10, 0.10, 0.20]), act([1, 1, 1, 1]), cov([0.9, 0.9, 0.9, 0.9]),
      [], NOW,
    )
    expect(k.metrics.devamsizlik.sonHafta).toBe(20)            // son tam hafta 0.20
    expect(k.metrics.devamsizlik.donemOrt).toBe(13)            // mean(0.1,0.1,0.1,0.2)=0.125→13
    expect(k.metrics.kapsama).toEqual({ sonHafta: 90, donemOrt: 90 })
    expect(k.metrics.aktivite).toEqual({ sonHafta: 100, donemOrt: 100 })
    expect(k.schoolName).toBe('Test Okulu')
    expect(k.donemStart).toBe('2026-02-01')
    expect(typeof k.generatedAt).toBe('string')
  })

  it('classAbsence %-çevrili ve gelen sırada', () => {
    const k = buildKarneData(
      'Okul', '2026-02-01', abs([0.05, 0.05, 0.05, 0.05]), act([1, 1, 1, 1]), cov([0.9, 0.9, 0.9, 0.9]),
      [cls('c1', '9-C', 0.30), cls('c2', '9-A', 0.05)], NOW,
    )
    expect(k.classAbsence[0]).toEqual({ name: '9-C', grade: 9, rate: 30 })
    expect(k.classAbsence[1]).toEqual({ name: '9-A', grade: 9, rate: 5 })
  })

  it('sınıf bozulması varsa warnings dolu (computeEarlyWarnings ile tutarlı)', () => {
    // okul oranı=(30+5)/200=0.175; 9-C 0.30 ≥ 0.175×1.5 ve ≥%10 → sınıf uyarısı
    const k = buildKarneData(
      'Okul', '2026-02-01', abs([0.05, 0.05, 0.05, 0.05]), act([1, 1, 1, 1]), cov([0.9, 0.9, 0.9, 0.9]),
      [cls('c1', '9-C', 0.30), cls('c2', '9-A', 0.05)], NOW,
    )
    expect(k.warnings.some(w => w.metric === 'sinif' && w.classId === 'c1')).toBe(true)
  })

  it('boş/yetersiz veri → metrikler 0, diziler boş, çökme yok', () => {
    const k = buildKarneData('Okul', '2026-02-01', [], [], [], [], NOW)
    expect(k.metrics.devamsizlik).toEqual({ sonHafta: 0, donemOrt: 0 })
    expect(k.classAbsence).toEqual([])
    expect(k.warnings).toEqual([])
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm run test:unit -- tests/vitest/unit/dashboard/karne.test.ts`
Expected: FAIL — `buildKarneData` modülü yok.

- [ ] **Step 4: Write minimal implementation**

`src/domains/dashboard/lib/karne.ts`:
```ts
import { currentWeekStart, computeEarlyWarnings, type EarlyWarning } from './earlyWarning'
import type {
  AbsenceTrendPoint, ActivityTrendPoint, CoverageTrendPoint, ClassAbsence,
} from './trendMath'

export type KarneMetric = { sonHafta: number; donemOrt: number }

export type KarneData = {
  schoolName: string
  donemStart: string
  generatedAt: string
  metrics: {
    devamsizlik: KarneMetric
    kapsama:     KarneMetric
    aktivite:    KarneMetric
  }
  classAbsence: { name: string; grade: number; rate: number }[]
  warnings: EarlyWarning[]
}

// Son tam hafta (% ) + tüm real haftaların ortalaması (%). Real/tam hafta yoksa 0/0.
function metricSummary(
  points: { weekStart: string; rate: number }[],
  realWeeks: Set<string>,
  now: Date,
): KarneMetric {
  const cw = currentWeekStart(now)
  const usable = points.filter(p => realWeeks.has(p.weekStart) && p.weekStart < cw)
  if (usable.length === 0) return { sonHafta: 0, donemOrt: 0 }
  const sonHafta = Math.round(usable[usable.length - 1].rate * 100)
  const donemOrt = Math.round((usable.reduce((s, p) => s + p.rate, 0) / usable.length) * 100)
  return { sonHafta, donemOrt }
}

export function buildKarneData(
  schoolName: string,
  donemStart: string,
  absence: AbsenceTrendPoint[],
  activity: ActivityTrendPoint[],
  coverage: CoverageTrendPoint[],
  classAbsence: ClassAbsence[],
  now: Date = new Date(),
): KarneData {
  const realWeeks = new Set(absence.filter(p => p.total > 0).map(p => p.weekStart))
  return {
    schoolName,
    donemStart,
    generatedAt: now.toISOString(),
    metrics: {
      devamsizlik: metricSummary(absence, realWeeks, now),
      kapsama:     metricSummary(coverage, realWeeks, now),
      aktivite:    metricSummary(activity, realWeeks, now),
    },
    classAbsence: classAbsence.map(c => ({ name: c.name, grade: c.grade, rate: Math.round(c.rate * 100) })),
    warnings: computeEarlyWarnings(absence, activity, coverage, classAbsence, now),
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm run test:unit -- tests/vitest/unit/dashboard/karne.test.ts`
Expected: PASS (4 test).

- [ ] **Step 6: Commit**

```bash
git add src/domains/dashboard/lib/earlyWarning.ts src/domains/dashboard/lib/karne.ts tests/vitest/unit/dashboard/karne.test.ts
git commit -m "feat: okul karnesi saf veri üreticisi (buildKarneData)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Server action `getOkulKarnesi`

**Files:**
- Create: `app/actions/karne.ts`

**Interfaces:**
- Consumes: `buildKarneData` (Task 1); mevcut sorgular + trend fonksiyonları + `donemBasi` + `getCurrentProfile` + `isMudurOrAbove`.
- Produces: `getOkulKarnesi(): Promise<KarneData>` (server action).

- [ ] **Step 1: Server action'ı yaz**

`app/actions/karne.ts`:
```ts
'use server'

import { getCurrentProfile } from '@/src/shared/auth'
import { isMudurOrAbove } from '@/src/shared/types'
import { donemBasi } from '@/src/shared/utils'
import { getSchoolTeachers } from '@/src/domains/dashboard/queries/schoolStats'
import {
  getAttendanceTrendRows, getHomeworkTrendRows, getTrendClasses,
} from '@/src/domains/dashboard/queries/schoolTrends'
import {
  computeAbsenceTrend, computeActivityTrend, computeCoverageTrend, computeClassAbsence,
} from '@/src/domains/dashboard/lib/trendMath'
import { buildKarneData, type KarneData } from '@/src/domains/dashboard/lib/karne'

export async function getOkulKarnesi(): Promise<KarneData> {
  const profile = await getCurrentProfile()
  if (!profile?.school_id || !isMudurOrAbove(profile.role)) {
    throw new Error('Bu rapora erişim yetkiniz yok')
  }
  const schoolId = profile.school_id
  const schoolName = profile.schools?.name ?? 'Okul'
  const donemStart = donemBasi()
  const now = new Date()

  const [attRows, hwRows, classes, teachers] = await Promise.all([
    getAttendanceTrendRows(schoolId, donemStart),
    getHomeworkTrendRows(schoolId, donemStart),
    getTrendClasses(schoolId),
    getSchoolTeachers(schoolId),
  ])

  const absence  = computeAbsenceTrend(attRows, donemStart, now)
  const activity = computeActivityTrend(attRows, hwRows, teachers.length, donemStart, now)
  const coverage = computeCoverageTrend(attRows, classes.length, donemStart, now)
  const classAbs = computeClassAbsence(attRows, classes)

  return buildKarneData(schoolName, donemStart, absence, activity, coverage, classAbs, now)
}
```
NOT: `getCurrentProfile()`'in döndürdüğü tipte `schools?.name` ve `role`/`school_id` alanlarının var olduğunu doğrula (mevcut kod `getCurrentProfile().schools?.name` desenini kullanıyor — ör. invite email). Yoksa proftipine uygun erişim kullan; okul adı fallback 'Okul'.

- [ ] **Step 2: Tip kontrolü**

Run: `npx --no-install tsc --noEmit 2>&1 | grep -i "actions/karne" | grep -v "EduDesk-Architecture\|migration-cleanup"`
Expected: çıktı YOK (temiz). Hata varsa `getCurrentProfile` dönüş tipine göre alan erişimini düzelt.

- [ ] **Step 3: Commit**

```bash
git add app/actions/karne.ts
git commit -m "feat: okul karnesi server action (getOkulKarnesi, RBAC müdür/MY)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Client PDF üreticisi `buildKarnePdf`

**Files:**
- Create: `app/(dashboard)/yonetim/karnePdf.ts`

**Interfaces:**
- Consumes: `createDoc` (`@/src/lib/createPdf`); `KarneData` (Task 1); `jspdf-autotable`.
- Produces: `buildKarnePdf(data: KarneData): Promise<void>` (PDF indirir).

> Referans: `app/(dashboard)/odevler/sinif/[classId]/MatrisClient.tsx` — `createDoc` + `jspdf-autotable` kullanımı (import stili, `autoTable(doc, {...})`, `doc.lastAutoTable?.finalY`). Aynı deseni izle.

- [ ] **Step 1: PDF üreticisini yaz**

`app/(dashboard)/yonetim/karnePdf.ts`:
```ts
'use client'

import { createDoc } from '@/src/lib/createPdf'
import { format } from '@/src/shared/date'
import type { KarneData } from '@/src/domains/dashboard/lib/karne'

const METRIC_LABEL = {
  devamsizlik: 'Devamsızlık',
  kapsama:     'Yoklama kapsama',
  aktivite:    'Öğretmen aktivitesi',
} as const

export async function buildKarnePdf(data: KarneData): Promise<void> {
  // autotable dinamik import — MatrisClient deseni (bundle'a girmez)
  const { default: autoTable } = await import('jspdf-autotable')
  const doc = await createDoc({ unit: 'pt', format: 'a4' })
  const pct = (n: number) => (n > 0 ? `%${n}` : '—')

  // Başlık
  doc.setFontSize(16)
  doc.text(data.schoolName, 40, 50)
  doc.setFontSize(12)
  doc.text('Okul Karnesi', 40, 70)
  doc.setFontSize(9)
  const donem = `${format(new Date(data.donemStart), 'd MMM yyyy')} – ${format(new Date(data.generatedAt), 'd MMM yyyy')}`
  doc.text(`Dönem: ${donem}`, 40, 86)

  // 1) Metrik tablosu
  autoTable(doc, {
    startY: 100,
    head: [['Metrik', 'Son hafta', 'Dönem ort.']],
    body: (['devamsizlik', 'kapsama', 'aktivite'] as const).map(k => [
      METRIC_LABEL[k], pct(data.metrics[k].sonHafta), pct(data.metrics[k].donemOrt),
    ]),
    styles: { font: 'Roboto', fontSize: 10 },
    headStyles: { font: 'Roboto', fillColor: [37, 99, 235] },
  })

  // 2) Sınıf karşılaştırması
  let y = (doc.lastAutoTable?.finalY ?? 100) + 24
  doc.setFontSize(12)
  doc.text('Sınıf Karşılaştırması — Devamsızlık', 40, y)
  autoTable(doc, {
    startY: y + 8,
    head: [['Sınıf', 'Devamsızlık']],
    body: data.classAbsence.length
      ? data.classAbsence.map(c => [c.name, `%${c.rate}`])
      : [['Yoklama verisi yok', '']],
    styles: { font: 'Roboto', fontSize: 10 },
    headStyles: { font: 'Roboto', fillColor: [37, 99, 235] },
  })

  // 3) Erken uyarılar
  y = (doc.lastAutoTable?.finalY ?? y) + 24
  doc.setFontSize(12)
  doc.text('Erken Uyarılar', 40, y)
  autoTable(doc, {
    startY: y + 8,
    head: [['Şiddet', 'Uyarı', 'Detay']],
    body: data.warnings.length
      ? data.warnings.map(w => [w.severity === 'yuksek' ? 'Yüksek' : 'Dikkat', w.title, w.detail])
      : [['', 'Aktif uyarı yok', '']],
    styles: { font: 'Roboto', fontSize: 9 },
    headStyles: { font: 'Roboto', fillColor: [37, 99, 235] },
  })

  doc.save(`okul-karnesi-${format(new Date(data.generatedAt), 'yyyy-MM-dd')}.pdf`)
}
```
NOT: `createDoc` `'use client'`'tir ve Roboto'yu `/public/fonts`'tan yükler — bu dosya da `'use client'`. `autoTable`'a `styles.font:'Roboto'` vererek Türkçe karakter garanti. `doc.lastAutoTable` `PdfDoc` tipinde mevcut.

- [ ] **Step 2: Tip kontrolü**

Run: `npx --no-install tsc --noEmit 2>&1 | grep -i "karnePdf" | grep -v "EduDesk-Architecture\|migration-cleanup"`
Expected: çıktı YOK. (jspdf-autotable tip uyumsuzluğu olursa MatrisClient'taki import/çağrı stiliyle eşle.)

- [ ] **Step 3: Commit**

```bash
git add "app/(dashboard)/yonetim/karnePdf.ts"
git commit -m "feat: okul karnesi PDF üreticisi (createDoc + autotable)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: `KarneIndirButton` + `/yönetim`'e bağla

**Files:**
- Create: `app/(dashboard)/yonetim/KarneIndirButton.tsx`
- Modify: `app/(dashboard)/yonetim/page.tsx`

**Interfaces:**
- Consumes: `getOkulKarnesi` (Task 2), `buildKarnePdf` (Task 3), `useToast` (mevcut).
- Produces: default export client component `KarneIndirButton`.

> Referans: `useToast`'un import yolu/kullanımı için mevcut bir client component'e bak (ör. `NobetKarti.tsx` veya `VeliIletisimForm.tsx` `useToast` kullanıyor). Aynı import yolunu kullan.

- [ ] **Step 1: Butonu yaz**

`app/(dashboard)/yonetim/KarneIndirButton.tsx`:
```tsx
'use client'

import { useState } from 'react'
import { getOkulKarnesi } from '@/app/actions/karne'
import { buildKarnePdf } from './karnePdf'
import { useToast } from '@/components/Toast'

export default function KarneIndirButton() {
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  async function handleClick() {
    setLoading(true)
    try {
      const data = await getOkulKarnesi()
      await buildKarnePdf(data)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Karne oluşturulamadı', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="inline-flex items-center gap-2 text-sm font-medium px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 disabled:opacity-50 transition-colors"
    >
      {loading ? 'Hazırlanıyor…' : 'Karne (PDF) indir'}
    </button>
  )
}
```
NOT: `useToast` import yolunu mevcut kullanımla doğrula (`grep -rn "useToast" app/ | head` → import path'i kopyala). `toast({variant:'destructive'})` imzası farklıysa mevcut kullanıma uydur.

- [ ] **Step 2: `/yönetim/page.tsx` başlığına ekle**

`app/(dashboard)/yonetim/page.tsx`'i OKU. Sayfanın üst başlık bölümünü bul (h1/başlık). Import ekle:
```tsx
import KarneIndirButton from './KarneIndirButton'
```
Başlık satırını, başlık metni solda + buton sağda olacak şekilde sar (mevcut layout'a uygun). Örnek (mevcut başlık yapısına uyarla):
```tsx
<div className="flex items-center justify-between gap-3">
  {/* mevcut başlık (h1 + alt metin) buraya */}
  <KarneIndirButton />
</div>
```
Buton yalnız bu sayfada görünür; sayfa zaten müdür+MY erişimli (server action ayrıca RBAC uygular).

- [ ] **Step 3: Doğrula**

Run: `npx --no-install tsc --noEmit 2>&1 | grep -iE "KarneIndir|yonetim/page" | grep -v "EduDesk-Architecture\|migration-cleanup"`
Expected: çıktı YOK.

Run: `npm run test:unit -- tests/vitest/unit/dashboard/karne.test.ts`
Expected: 4 PASS (regresyon yok).

- [ ] **Step 4: Commit**

```bash
git add "app/(dashboard)/yonetim/KarneIndirButton.tsx" "app/(dashboard)/yonetim/page.tsx"
git commit -m "feat: /yönetim'e Karne (PDF) indir butonu

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review

**1. Spec coverage:**
- Saf `buildKarneData` (KarneData: metrics/classAbsence/warnings) → Task 1. ✓
- Metrik = son tam hafta + dönem ortalaması (% ) → Task 1 `metricSummary`. ✓
- Server action RBAC müdür/MY + mevcut sorgular + `donemBasi` → Task 2. ✓
- Client PDF, `createDoc`/Roboto + autotable, 3 bölüm (metrik/sınıf/uyarı) → Task 3. ✓
- `/yönetim`'de buton, müdür+MY → Task 4. ✓
- Test: `buildKarneData` saf testleri → Task 1; PDF/action test edilmez (spec'e uygun). ✓
- Kapsam dışı (bildirim/Excel) plana alınmadı. ✓

**2. Placeholder scan:** Kod blokları tam; "TBD"/"benzer şekilde" yok. `useToast`/`getCurrentProfile`/autotable için "mevcut kullanımı doğrula" notları var (gerçek import yolu kod tabanına bağlı) — bunlar placeholder değil, doğrulama adımı.

**3. Type consistency:** `KarneData`/`KarneMetric` Task 1'de tanımlı, Task 2-3'te aynı şekil kullanılıyor; `buildKarneData` imzası Task 2 çağrısıyla bire bir; `currentWeekStart` Task 1'de export ediliyor, `karne.ts` import ediyor; `rate` kesir→% çevrimi yalnız `buildKarneData`'da (PDF zaten % alır). ✓

> Bilinen kabul (spec ile uyumlu): metrik "dönem ortalaması" = tüm real haftaların ortalaması (baz-ortalaması değil); erken-uyarı eşik mantığından kasıtlı olarak farklı (rapor özeti için daha sezgisel).
