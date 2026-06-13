# Quick Wins + Dashboard İyileştirmeleri Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 9 küçük UX iyileştirmesi — `window.confirm` kaldır, tıklanamaz elementleri linkle, boş durum mesajları ekle, dashboard widget'larını güçlendir.

**Architecture:** Tüm değişiklikler mevcut dosyalarda; yeni dosya sadece `WidgetErrorBoundary.tsx`. Saf UI değişiklikleri — DB sorgusu, action, repository değişikliği yok. `BulkContext` ve `YoklamaClient` state yönetimi genişler.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind v4, Vitest (unit tests — React Testing Library yok, UI testleri manuel)

**NOT:** A2 (ödev formunda geçmiş tarih engeli) `ClassWeekLoadSection.tsx`'te zaten `min={todayISO()}` ile uygulanmış — bu görev atlandı.

---

### Task 1: BulkContext — `window.confirm` → inline onay (A1a)

**Files:**
- Modify: `app/(dashboard)/odevler/BulkContext.tsx`

- [ ] **Step 1: `confirmingDelete` state ve yeni delete akışı ekle**

`BulkContext.tsx` içinde:

```tsx
// Mevcut state'lerin altına ekle
const [confirmingDelete, setConfirmingDelete] = useState(false)

// handleDelete tamamen yenile
function handleDelete() {
  if (!confirmingDelete) {
    setConfirmingDelete(true)
    return
  }
  startTransition(async () => {
    await bulkDeleteHomeworks([...selected])
    setBulkMode(false)
    setConfirmingDelete(false)
    router.refresh()
  })
}
```

- [ ] **Step 2: Floating action bar UI güncelle**

`BulkContext.tsx` içindeki `{bulkMode && (...)}` bloğunu değiştir:

```tsx
{bulkMode && (
  <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 bg-gray-900 dark:bg-slate-700 text-white rounded-2xl shadow-2xl px-4 py-3">
    {confirmingDelete ? (
      <>
        <span className="text-sm font-medium whitespace-nowrap text-red-300">
          {selected.size} ödev silinecek!
        </span>
        <button
          onClick={() => setConfirmingDelete(false)}
          className="text-xs text-gray-400 hover:text-white transition-colors whitespace-nowrap"
        >
          İptal
        </button>
        <button
          onClick={handleDelete}
          disabled={isPending}
          className="flex items-center gap-1.5 bg-red-500 hover:bg-red-600 disabled:opacity-60 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
        >
          {isPending ? 'Siliniyor...' : 'Onayla — Sil'}
        </button>
      </>
    ) : (
      <>
        <span className="text-sm font-medium whitespace-nowrap">
          {selected.size > 0 ? `${selected.size} ödev seçildi` : 'Ödev seç'}
        </span>
        {selected.size > 0 && (
          <button
            onClick={handleDelete}
            disabled={isPending}
            className="flex items-center gap-1.5 bg-red-500 hover:bg-red-600 disabled:opacity-60 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Seçilenleri Sil
          </button>
        )}
        <button
          onClick={() => setBulkMode(false)}
          className="text-xs text-gray-400 hover:text-white transition-colors"
        >
          İptal
        </button>
      </>
    )}
  </div>
)}
```

Ayrıca `setBulkMode` fonksiyonuna `confirmingDelete` sıfırlaması ekle:
```tsx
function setBulkMode(v: boolean) {
  setBulkModeState(v)
  if (!v) {
    setSelected(new Set())
    setConfirmingDelete(false)  // YENİ
  }
}
```

- [ ] **Step 3: TypeScript kontrolü**

```
npx tsc --noEmit
```

Beklenen: 0 hata

- [ ] **Step 4: Commit**

```bash
git add app/(dashboard)/odevler/BulkContext.tsx
git commit -m "fix(odevler): toplu silme window.confirm → inline onay aşaması"
```

---

### Task 2: YoklamaClient — `window.confirm` → inline banner (A1b)

**Files:**
- Modify: `app/(dashboard)/yoklama/YoklamaClient.tsx`

- [ ] **Step 1: `pendingSwitch` state ekle, `guardDirty` kaldır**

`YoklamaClient.tsx` içinde mevcut `const guardDirty = useCallback(...)` bloğunu tamamen kaldır.

Yerine şunları ekle (`const [now, setNow] = useState(...)` satırından sonra):

```tsx
const [pendingSwitch, setPendingSwitch] = useState<{ type: 'class' | 'date'; value: string } | null>(null)

function applySwitch(type: 'class' | 'date', value: string) {
  if (type === 'class') setClassId(value)
  else setDate(value)
  isDirty.current = false
  setPendingSwitch(null)
}

function trySwitch(type: 'class' | 'date', value: string) {
  if (!isDirty.current) { applySwitch(type, value); return }
  setPendingSwitch({ type, value })
}
```

- [ ] **Step 2: `handleClassChange` ve `handleDateChange` güncelle**

```tsx
// Eski:
const handleClassChange = useCallback((e: ChangeEvent<HTMLSelectElement>) => {
  if (!guardDirty()) return
  setClassId(e.target.value)
}, [guardDirty])

const handleDateChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
  if (!guardDirty()) return
  setDate(e.target.value)
}, [guardDirty])

// Yeni:
const handleClassChange = useCallback((e: ChangeEvent<HTMLSelectElement>) => {
  trySwitch('class', e.target.value)
}, [])  // trySwitch closure içinde, bağımlılık yok

const handleDateChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
  trySwitch('date', e.target.value)
}, [])
```

`useCallback` import'u artık sadece bu iki fonksiyon için kullanılıyorsa silebilirsin ya da bırakabilirsin.

- [ ] **Step 3: Banner JSX ekle**

`return (` içindeki `<div className="space-y-4">` açılışından hemen sonra, sınıf+tarih kartından ÖNCE:

```tsx
{pendingSwitch && (
  <div className="flex flex-wrap items-center gap-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-700 rounded-xl px-4 py-3 text-amber-800 dark:text-amber-300">
    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
    </svg>
    <span className="text-sm flex-1">Kaydedilmemiş değişiklikler var.</span>
    <button
      onClick={() => setPendingSwitch(null)}
      className="text-xs font-medium text-amber-700 dark:text-amber-400 hover:underline"
    >
      Geri dön
    </button>
    <button
      onClick={() => applySwitch(pendingSwitch.type, pendingSwitch.value)}
      className="text-xs font-semibold bg-amber-100 dark:bg-amber-800/50 text-amber-800 dark:text-amber-200 px-2 py-1 rounded-lg hover:bg-amber-200 dark:hover:bg-amber-800 transition-colors"
    >
      Devam et ve kaybet
    </button>
  </div>
)}
```

- [ ] **Step 4: TypeScript + test**

```
npx tsc --noEmit
npx vitest run
```

Beklenen: 0 hata, tüm testler yeşil

- [ ] **Step 5: Commit**

```bash
git add app/(dashboard)/yoklama/YoklamaClient.tsx
git commit -m "fix(yoklama): kaydedilmemis degisiklik uyarisi window.confirm → inline banner"
```

---

### Task 3: "Yoklama Tamam" tıklanabilir (A3)

**Files:**
- Modify: `app/(dashboard)/anasayfa/HizliAksiyonlar.tsx`

- [ ] **Step 1: `div` → `Link` dönüştür**

`HizliAksiyonlar.tsx` içindeki (satır 30–36) tıklanamaz `<div>` bloğunu `<Link>` yap:

```tsx
// Eski:
<div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 text-xs font-semibold border border-emerald-200 dark:border-emerald-800">
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
  </svg>
  Yoklama Tamam
</div>

// Yeni:
<Link
  href="/yoklama"
  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:hover:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 text-xs font-semibold border border-emerald-200 dark:border-emerald-800 transition-colors"
>
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
  </svg>
  Yoklama Tamam
</Link>
```

`Link` dosyanın en üstünde zaten import edilmiş (`import Link from 'next/link'`).

- [ ] **Step 2: Commit**

```bash
git add app/(dashboard)/anasayfa/HizliAksiyonlar.tsx
git commit -m "fix(anasayfa): Yoklama Tamam div → tıklanabilir Link"
```

---

### Task 4: Okul kodu müdür yardımcısına göster (A4)

**Files:**
- Modify: `app/(dashboard)/kullanicilar/page.tsx`

- [ ] **Step 1: `schoolData` sorgusunu `isMY` için de aç**

`page.tsx` içinde Promise.all içindeki school sorgusu:

```typescript
// Eski:
isMudur && profile.school_id
  ? supabase.from('schools').select('slug').eq('id', profile.school_id).single()
  : Promise.resolve({ data: null }),

// Yeni:
(isMudur || isMY) && profile.school_id
  ? supabase.from('schools').select('slug').eq('id', profile.school_id).single()
  : Promise.resolve({ data: null }),
```

- [ ] **Step 2: JSX'teki koşulu genişlet**

```tsx
// Eski:
{isMudur && (
  <SchoolCodeCard initialCode={(schoolData as { slug?: string } | null)?.slug ?? null} />
)}

// Yeni:
{(isMudur || isMY) && (
  <SchoolCodeCard initialCode={(schoolData as { slug?: string } | null)?.slug ?? null} />
)}
```

- [ ] **Step 3: TypeScript kontrolü**

```
npx tsc --noEmit
```

Beklenen: 0 hata

- [ ] **Step 4: Commit**

```bash
git add app/(dashboard)/kullanicilar/page.tsx
git commit -m "fix(kullanicilar): okul kodu mudur yardimcisina da goster"
```

---

### Task 5: Veli portalında devamsızlık sıfır durumu (A5)

**Files:**
- Modify: `app/veli/[token]/VeliDevamsizlikSection.tsx`

- [ ] **Step 1: Early return'ü kaldır, empty state ekle**

`VeliDevamsizlikSection.tsx` içindeki satır 15'teki erken return kaldırılır. Bölüm her zaman render edilir; sayılar sıfırsa yerine özel mesaj gösterilir:

```tsx
export default function VeliDevamsizlikSection({
  attendance,
  absentCount,
  lateCount,
}: {
  attendance: AttendanceRow[]
  absentCount: number
  lateCount: number
}) {
  const isEmpty = absentCount === 0 && lateCount === 0

  return (
    <section data-veli-section="devamsizlik" className="bg-white border border-gray-200 rounded-2xl p-4">
      <h2 className="text-sm font-semibold text-gray-700 mb-3">Devamsızlık — Son 90 Gün</h2>

      {isEmpty ? (
        <div className="flex items-center gap-2 py-3 px-3 bg-emerald-50 border border-emerald-100 rounded-xl">
          <svg className="w-4 h-4 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
          <p className="text-sm text-emerald-700">Bu dönemde devamsızlık kaydı bulunmuyor.</p>
        </div>
      ) : (
        <>
          <VeliDevamsizlikChart attendance={attendance} />
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className={`rounded-xl p-3 text-center ${absentCount > 0 ? 'bg-red-50 border border-red-200' : 'bg-gray-50 border border-gray-200'}`}>
              <p className={`text-2xl font-bold ${absentCount > 0 ? 'text-red-600' : 'text-gray-400'}`}>{absentCount}</p>
              <p className={`text-xs mt-0.5 ${absentCount > 0 ? 'text-red-500' : 'text-gray-400'}`}>Gelmedi</p>
            </div>
            <div className={`rounded-xl p-3 text-center ${lateCount > 0 ? 'bg-orange-50 border border-orange-200' : 'bg-gray-50 border border-gray-200'}`}>
              <p className={`text-2xl font-bold ${lateCount > 0 ? 'text-orange-600' : 'text-gray-400'}`}>{lateCount}</p>
              <p className={`text-xs mt-0.5 ${lateCount > 0 ? 'text-orange-500' : 'text-gray-400'}`}>Geç Geldi</p>
            </div>
          </div>
          {attendance.length > 0 && (
            <div className="space-y-1.5">
              {attendance.slice(0, 10).map(a => (
                <div key={a.date} className="flex items-center justify-between py-1 border-b border-gray-50 last:border-0">
                  <p className="text-sm text-gray-700">{format(parseISO(a.date), 'd MMMM yyyy')}</p>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
                    a.status === 'absent'
                      ? 'bg-red-50 text-red-600 border-red-200'
                      : 'bg-orange-50 text-orange-600 border-orange-200'
                  }`}>
                    {a.status === 'absent' ? 'Gelmedi' : 'Geç Geldi'}
                  </span>
                </div>
              ))}
              {attendance.length > 10 && (
                <p className="text-xs text-gray-400 text-center pt-1">
                  +{attendance.length - 10} kayıt daha
                </p>
              )}
            </div>
          )}
        </>
      )}
    </section>
  )
}
```

- [ ] **Step 2: TypeScript kontrolü**

```
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add app/veli/[token]/VeliDevamsizlikSection.tsx
git commit -m "fix(veli): devamsizlik sifir durumunda bolum gizlenmiyor, bos durum mesaji goster"
```

---

### Task 6: Risk widget "Tümünü gör" linki (C1)

**Files:**
- Modify: `app/(dashboard)/anasayfa/RiskUyarilariWidget.tsx`

- [ ] **Step 1: Header sayı badge'ini Link yap, liste sonuna "daha fazla" satırı ekle**

`RiskUyarilariWidget.tsx`:

```tsx
import Link from 'next/link'  // zaten mevcut
```

Header kısmı (satır 63–65):

```tsx
// Eski:
{alerts.length > 5 && (
  <span className="text-xs text-gray-400">{alerts.length} öğrenci</span>
)}

// Yeni:
{alerts.length > 5 && (
  <Link href="/siniflar" className="text-xs text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
    {alerts.length} öğrenci →
  </Link>
)}
```

Liste sonuna (closing `</ul>` den önce), `displayed.length < alerts.length` koşuluyla:

```tsx
<ul className="space-y-2">
  {displayed.map(alert => (
    <li key={alert.studentId}>
      {/* ... mevcut kod ... */}
    </li>
  ))}
  {alerts.length > 5 && (
    <li>
      <Link
        href="/siniflar"
        className="flex items-center justify-center gap-1 py-2 text-xs text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700/50"
      >
        + {alerts.length - 5} öğrenci daha · Tümünü gör →
      </Link>
    </li>
  )}
</ul>
```

- [ ] **Step 2: TypeScript kontrolü**

```
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add app/(dashboard)/anasayfa/RiskUyarilariWidget.tsx
git commit -m "fix(anasayfa): risk widget 5+ ogrenci icin Tümünü gor linki"
```

---

### Task 7: WidgetErrorBoundary oluştur (C2)

**Files:**
- Create: `app/(dashboard)/anasayfa/WidgetErrorBoundary.tsx`
- Modify: `app/(dashboard)/anasayfa/page.tsx`

- [ ] **Step 1: `WidgetErrorBoundary.tsx` oluştur**

```tsx
'use client'

import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  label?: string
}

interface State {
  hasError: boolean
}

export default class WidgetErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4 text-center text-sm text-gray-400 dark:text-slate-500">
          {this.props.label ?? 'Widget'} yüklenemedi.
        </div>
      )
    }
    return this.props.children
  }
}
```

- [ ] **Step 2: `page.tsx`'te import et ve MudurOgretmenAktivite'yi sar**

`app/(dashboard)/anasayfa/page.tsx` içinde:

```tsx
import WidgetErrorBoundary from './WidgetErrorBoundary'
```

Ve ilgili `<Suspense>` bloğunu güncelle:

```tsx
// Eski:
<Suspense fallback={<WidgetSkeleton tall />}>
  <MudurOgretmenAktivite />
</Suspense>

// Yeni:
<Suspense fallback={<WidgetSkeleton tall />}>
  <WidgetErrorBoundary label="Öğretmen aktivitesi">
    <MudurOgretmenAktivite />
  </WidgetErrorBoundary>
</Suspense>
```

- [ ] **Step 3: TypeScript kontrolü**

```
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add app/(dashboard)/anasayfa/WidgetErrorBoundary.tsx app/(dashboard)/anasayfa/page.tsx
git commit -m "fix(anasayfa): MudurOgretmenAktivite icin error boundary ekle"
```

---

### Task 8: BugunYapilacaklar — yeni öğretmen durumu (C3)

**Files:**
- Modify: `app/(dashboard)/anasayfa/BugunYapilacaklarWidget.tsx`
- Modify: `app/(dashboard)/anasayfa/OgretmenDashboard.tsx`

- [ ] **Step 1: `BugunYapilacaklarWidget`'e `hasClasses` prop ekle**

`BugunYapilacaklarWidget.tsx` içinde `Props` interface'ini güncelle:

```tsx
interface Props {
  yoklamaDurumu:   YoklamaDurumItem[]
  todayHomeworks:  HomeworkLite[]
  activeRiskCount: number
  hasClasses:      boolean  // YENİ
}
```

Fonksiyon parametresine ekle:

```tsx
export default function BugunYapilacaklarWidget({ yoklamaDurumu, todayHomeworks, activeRiskCount, hasClasses }: Props) {
```

`allDone` hesabını güncelle:

```tsx
// Eski:
const allDone = eksikYoklama.length === 0 && todayHomeworks.length === 0 && activeRiskCount === 0

// Yeni:
const allDone    = hasClasses && eksikYoklama.length === 0 && todayHomeworks.length === 0 && activeRiskCount === 0
const noClasses  = !hasClasses && todayHomeworks.length === 0 && activeRiskCount === 0
```

Header badge koşulunu güncelle:

```tsx
// Eski:
{allDone && (
  <span className="...">Tümü tamam ✓</span>
)}

// Yeni:
{allDone && (
  <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full">
    Tümü tamam ✓
  </span>
)}
```

`{/* Her şey tamam */}` bloğunu güncelle:

```tsx
{/* Her şey tamam */}
{allDone && (
  <div className="px-4 py-4 text-center">
    <p className="text-sm text-gray-400 dark:text-slate-500">Bugün için bekleyen işlem yok.</p>
  </div>
)}

{/* Henüz sınıf atanmamış */}
{noClasses && (
  <div className="px-4 py-4 text-center">
    <p className="text-sm text-gray-400 dark:text-slate-500">Henüz sınıf atanmamış.</p>
  </div>
)}
```

- [ ] **Step 2: `OgretmenDashboard.tsx`'te prop geç**

`OgretmenDashboard.tsx` içinde `<BugunYapilacaklarWidget>` kullanımını güncelle:

```tsx
// Eski:
<BugunYapilacaklarWidget
  yoklamaDurumu={metrics.yoklamaDurumu}
  todayHomeworks={todayHws}
  activeRiskCount={metrics.activeRiskCount}
/>

// Yeni:
<BugunYapilacaklarWidget
  yoklamaDurumu={metrics.yoklamaDurumu}
  todayHomeworks={todayHws}
  activeRiskCount={metrics.activeRiskCount}
  hasClasses={metrics.yoklamaDurumu.length > 0}
/>
```

- [ ] **Step 3: TypeScript kontrolü**

```
npx tsc --noEmit
```

Beklenen: 0 hata

- [ ] **Step 4: Commit**

```bash
git add app/(dashboard)/anasayfa/BugunYapilacaklarWidget.tsx app/(dashboard)/anasayfa/OgretmenDashboard.tsx
git commit -m "fix(anasayfa): yeni ogretmen icin sinif atanmamis durumu BugunYapilacaklar"
```

---

### Task 9: Yoklama satırlarına link (C4)

**Files:**
- Modify: `app/(dashboard)/anasayfa/BugunYapilacaklarWidget.tsx`

- [ ] **Step 1: Yoklama listesindeki `<li>`'leri Link'e çevir**

`BugunYapilacaklarWidget.tsx` içindeki yoklama `<ul>` bloğunu güncelle.

`Link` import'unu ekle (zaten mevcut olabilir — kontrol et):

```tsx
import Link from 'next/link'
```

Yoklama satırları:

```tsx
// Eski:
<ul className="space-y-1.5">
  {yoklamaDurumu.map(c => (
    <li key={c.classId} className="flex items-center gap-2">
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${c.alindi ? 'bg-emerald-500' : 'bg-red-400'}`} />
      <span className="text-sm text-gray-800 dark:text-slate-200 font-medium">{c.className}</span>
      <span className={`text-[10px] font-semibold ${c.alindi ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
        {c.alindi ? 'Alındı' : 'Alınmadı'}
      </span>
    </li>
  ))}
</ul>

// Yeni:
<ul className="space-y-1.5">
  {yoklamaDurumu.map(c => (
    <li key={c.classId}>
      <Link
        href="/yoklama"
        className="flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-slate-700/50 rounded-lg px-1 -mx-1 transition-colors"
      >
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${c.alindi ? 'bg-emerald-500' : 'bg-red-400'}`} />
        <span className="text-sm text-gray-800 dark:text-slate-200 font-medium">{c.className}</span>
        <span className={`text-[10px] font-semibold ${c.alindi ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
          {c.alindi ? 'Alındı' : 'Alınmadı'}
        </span>
      </Link>
    </li>
  ))}
</ul>
```

- [ ] **Step 2: Final TypeScript + test**

```
npx tsc --noEmit
npx vitest run
```

Beklenen: 0 hata, 779+ test yeşil

- [ ] **Step 3: Push**

```bash
git add app/(dashboard)/anasayfa/BugunYapilacaklarWidget.tsx
git commit -m "fix(anasayfa): BugunYapilacaklar yoklama satirlarina /yoklama linki"
git push origin main
```

---

## Doğrulama Kontrol Listesi

Manuel test (tarayıcıda):

- [ ] Ödevler → toplu seç → "Seçilenleri Sil" → inline "X ödev silinecek!" / [İptal] [Onayla] görünür
- [ ] Yoklama → bir öğrenciyi değiştir → sınıf değiştirmeye çalış → sarı uyarı banner çıkar
- [ ] Anasayfa → "Yoklama Tamam" → tıklanınca `/yoklama` sayfasına gider
- [ ] Kullanıcılar → müdür yardımcısı hesabıyla giriş → okul kodu görünür
- [ ] Veli portalı → devamsızlıksız öğrenci → "Bu dönemde devamsızlık kaydı bulunmuyor." görünür
- [ ] Anasayfa → 6+ riskli öğrenci → widget'ta link ve "+ X öğrenci daha" satırı görünür
- [ ] Anasayfa → sınıf atanmamış yeni öğretmen → "Henüz sınıf atanmamış." görünür
- [ ] Anasayfa → yoklama satırına tıkla → `/yoklama` sayfasına gider
