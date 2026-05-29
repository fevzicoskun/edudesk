# Mobil Uyumluluk Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tailwind class düzeltmeleriyle tüm uygulamayı telefon (360-428px) uyumlu hale getir.

**Architecture:** Sistematik sweep — her bileşende `grid-cols-N` → `grid-cols-1 sm:grid-cols-N` dönüşümü. Not Defteri tablosunda mobilde sütun gizleme. Yeni bileşen ya da abstraction yok.

**Tech Stack:** Next.js App Router, Tailwind CSS v4, React

---

### Task 1: Dashboard Stat Kartları (3 bileşen)

**Files:**
- Modify: `app/(dashboard)/anasayfa/MudurGunlukOzetKartlari.tsx:76`
- Modify: `app/(dashboard)/anasayfa/OgretmenDashboard.tsx:67`
- Modify: `app/(dashboard)/anasayfa/SinavOrtalamaWidget.tsx:78`

- [ ] **Adım 1: MudurGunlukOzetKartlari grid düzelt**

`app/(dashboard)/anasayfa/MudurGunlukOzetKartlari.tsx` satır 76:
```tsx
// Eski:
<div className="grid grid-cols-3 gap-3">
// Yeni:
<div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
```

- [ ] **Adım 2: OgretmenDashboard grid düzelt**

`app/(dashboard)/anasayfa/OgretmenDashboard.tsx` satır 67:
```tsx
// Eski:
<div className="grid grid-cols-3 gap-3 mb-4">
// Yeni:
<div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
```

- [ ] **Adım 3: SinavOrtalamaWidget grid düzelt**

`app/(dashboard)/anasayfa/SinavOrtalamaWidget.tsx` satır 78:
```tsx
// Eski:
<div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-slate-700/50">
// Yeni:
<div className="grid grid-cols-3 sm:grid-cols-3 gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-slate-700/50">
```
> Not: SinavOrtalamaWidget metrikleri (Genel ort./Geçme/En başarılı) küçük ve 3 sütun mobilde okunabilir kalır — sadece text küçültmek yeterli. Bu dosyada değişiklik gerekmez. Adımı atla.

- [ ] **Adım 4: Commit**

```bash
git add app/(dashboard)/anasayfa/MudurGunlukOzetKartlari.tsx app/(dashboard)/anasayfa/OgretmenDashboard.tsx
git commit -m "fix(mobile): dashboard stat kartları tek sütun mobilde"
```

---

### Task 2: Form Grid'leri (4 bileşen)

**Files:**
- Modify: `app/(dashboard)/not-defteri/[classId]/AddColumnModal.tsx:67`
- Modify: `app/(dashboard)/profil/dosyam/gunluk-plan/yeni/GunlukPlanForm.tsx:68`
- Modify: `app/(dashboard)/profil/dosyam/sok/yeni/SokForm.tsx:65`
- Modify: `app/(dashboard)/profil/dosyam/defter-kontrolu/NotebookCheckClient.tsx:24`

- [ ] **Adım 1: AddColumnModal grid düzelt**

`app/(dashboard)/not-defteri/[classId]/AddColumnModal.tsx` satır 67:
```tsx
// Eski:
<div className="grid grid-cols-2 gap-3">
// Yeni:
<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
```

- [ ] **Adım 2: GunlukPlanForm grid düzelt**

`app/(dashboard)/profil/dosyam/gunluk-plan/yeni/GunlukPlanForm.tsx` satır 68:
```tsx
// Eski:
<div className="grid grid-cols-2 gap-3">
// Yeni:
<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
```

- [ ] **Adım 3: SokForm grid düzelt**

`app/(dashboard)/profil/dosyam/sok/yeni/SokForm.tsx` satır 65:
```tsx
// Eski:
<div className="grid grid-cols-3 gap-3">
// Yeni:
<div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
```

- [ ] **Adım 4: NotebookCheckClient grid düzelt**

`app/(dashboard)/profil/dosyam/defter-kontrolu/NotebookCheckClient.tsx` satır 24:
```tsx
// Eski:
<div className="grid grid-cols-3 gap-2 mb-2">
// Yeni:
<div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-2">
```

- [ ] **Adım 5: Commit**

```bash
git add "app/(dashboard)/not-defteri/[classId]/AddColumnModal.tsx" \
        "app/(dashboard)/profil/dosyam/gunluk-plan/yeni/GunlukPlanForm.tsx" \
        "app/(dashboard)/profil/dosyam/sok/yeni/SokForm.tsx" \
        "app/(dashboard)/profil/dosyam/defter-kontrolu/NotebookCheckClient.tsx"
git commit -m "fix(mobile): form grid'leri tek sütun mobilde"
```

---

### Task 3: Sayfa İçi Grid'ler (3 bileşen)

**Files:**
- Modify: `app/(dashboard)/yonetim/OkulSeviyesiKartlari.tsx:49`
- Modify: `app/(dashboard)/siniflar/[id]/PerformansWidget.tsx:34`
- Modify: `app/(dashboard)/anasayfa/SchoolMeetings.tsx:94`

- [ ] **Adım 1: OkulSeviyesiKartlari grid düzelt**

`app/(dashboard)/yonetim/OkulSeviyesiKartlari.tsx` satır 49:
```tsx
// Eski:
<div className="grid grid-cols-3 gap-3">
// Yeni:
<div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
```

- [ ] **Adım 2: PerformansWidget grid düzelt**

`app/(dashboard)/siniflar/[id]/PerformansWidget.tsx` satır 34:
```tsx
// Eski:
<div className="grid grid-cols-3 gap-3 mb-5">
// Yeni:
<div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
```

- [ ] **Adım 3: SchoolMeetings grid düzelt**

`app/(dashboard)/anasayfa/SchoolMeetings.tsx` satır 94:
```tsx
// Eski:
<div className="grid grid-cols-2 gap-2">
// Yeni:
<div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
```

- [ ] **Adım 4: Commit**

```bash
git add "app/(dashboard)/yonetim/OkulSeviyesiKartlari.tsx" \
        "app/(dashboard)/siniflar/[id]/PerformansWidget.tsx" \
        "app/(dashboard)/anasayfa/SchoolMeetings.tsx"
git commit -m "fix(mobile): okul seviye/performans/toplantı kartları tek sütun"
```

---

### Task 4: MobileNavDrawer

**Files:**
- Modify: `components/layout/MobileNavDrawer.tsx:51`

- [ ] **Adım 1: Grid sütun sayısını 4'e çıkar**

`components/layout/MobileNavDrawer.tsx` satır 51:
```tsx
// Eski:
<nav className="px-4 pb-safe-or-4 grid grid-cols-3 gap-2 pt-3">
// Yeni:
<nav className="px-4 pb-safe-or-4 grid grid-cols-4 gap-1 pt-3">
```

- [ ] **Adım 2: Nav item padding küçült**

Aynı dosyada `py-3 px-2` → `py-2.5 px-1`:
```tsx
// Eski:
className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl text-xs font-medium transition-colors ${
// Yeni:
className={`flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl text-xs font-medium transition-colors ${
```

- [ ] **Adım 3: Commit**

```bash
git add components/layout/MobileNavDrawer.tsx
git commit -m "fix(mobile): drawer nav 4 sütun düzeni"
```

---

### Task 5: Not Defteri — Sütun Gizleme

**Files:**
- Modify: `app/(dashboard)/not-defteri/[classId]/GradeGrid.tsx`

- [ ] **Adım 1: Son sütun indexini hesapla**

`GradeGrid.tsx` içinde `return (` bloğundan önce (satır 116 civarı):
```tsx
const lastColIdx = columns.length - 1
```

- [ ] **Adım 2: TableHead'lere sütun gizleme ekle**

Satır 145 — column header map:
```tsx
{columns.map((col, colIdx) => (
  <TableHead
    key={col.id}
    className={`text-center min-w-[120px] ${colIdx !== lastColIdx ? 'hidden sm:table-cell' : ''}`}
  >
```

- [ ] **Adım 3: TableCell'lere sütun gizleme ekle**

Satır 182 — column cell map:
```tsx
{columns.map((col, colIdx) => (
  <TableCell
    key={col.id}
    className={`text-center ${colIdx !== lastColIdx ? 'hidden sm:table-cell' : ''}`}
  >
```

- [ ] **Adım 4: Footer ortalama hücrelere gizleme ekle**

Satır 225 — columnAverages map:
```tsx
{columnAverages.map((avg, i) => (
  <TableCell
    key={columns[i]!.id}
    className={`text-center text-sm font-medium ${i !== lastColIdx ? 'hidden sm:table-cell' : ''}`}
  >
    {avg}
  </TableCell>
))}
```

- [ ] **Adım 5: Commit**

```bash
git add "app/(dashboard)/not-defteri/[classId]/GradeGrid.tsx"
git commit -m "fix(mobile): not defteri mobilde son sütun göster, diğerleri gizle"
```

---

### Task 6: RaporButton Dropdown Genişlik

**Files:**
- Modify: `components/RaporButton.tsx:115`

- [ ] **Adım 1: Dropdown genişliğini telefona uyarla**

`components/RaporButton.tsx` satır 115:
```tsx
// Eski:
<div className="absolute right-0 top-full mt-1.5 z-20 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-lg w-64">
// Yeni:
<div className="absolute right-0 top-full mt-1.5 z-20 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-lg w-[calc(100vw-2rem)] sm:w-64">
```

- [ ] **Adım 2: Commit**

```bash
git add components/RaporButton.tsx
git commit -m "fix(mobile): rapor dropdown tam genişlik telefonda"
```

---

### Task 7: Loading Skeleton Grid'leri

**Files:**
- Modify: `app/(dashboard)/odevler/loading.tsx:19`

- [ ] **Adım 1: Ödevler loading skeleton düzelt**

`app/(dashboard)/odevler/loading.tsx` satır 19:
```tsx
// Eski:
<div className="grid grid-cols-3 gap-3 mb-6">
// Yeni:
<div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
```

- [ ] **Adım 2: Commit**

```bash
git add "app/(dashboard)/odevler/loading.tsx"
git commit -m "fix(mobile): ödevler loading skeleton tek sütun mobilde"
```

---

### Task 8: Genel Spacing & Buton Wrap

**Files:**
- Modify: `app/(dashboard)/anasayfa/page.tsx`
- Modify: `app/(dashboard)/odevler/page.tsx` (header buton grubu)
- Modify: `app/(dashboard)/siniflar/page.tsx` (header)

- [ ] **Adım 1: Anasayfa header buton grubu**

`app/(dashboard)/anasayfa/page.tsx` içindeki header buton gruplarına `flex-wrap` ekle (varsa `flex gap-2` olan satırlar):

Dosyayı aç, `flex gap-2` olan header aksiyonlarına `flex-wrap` ekle:
```tsx
// Eski: className="flex gap-2"
// Yeni: className="flex flex-wrap gap-2"
```

- [ ] **Adım 2: Ödevler sayfası header buton grubu**

`app/(dashboard)/odevler/page.tsx` header aksiyonlarında `flex gap-2` varsa `flex flex-wrap gap-2` yap.

- [ ] **Adım 3: Sınıflar sayfası header**

`app/(dashboard)/siniflar/page.tsx` header aksiyonlarında `flex gap-2` varsa `flex flex-wrap gap-2` yap.

- [ ] **Adım 4: Commit**

```bash
git add "app/(dashboard)/anasayfa/page.tsx" \
        "app/(dashboard)/odevler/page.tsx" \
        "app/(dashboard)/siniflar/page.tsx"
git commit -m "fix(mobile): header buton grupları flex-wrap ile taşmayı önle"
```

---

### Task 9: Push & Doğrulama

- [ ] **Adım 1: Push**

```bash
git push origin main
```

- [ ] **Adım 2: Doğrulama kontrol listesi**

Vercel deploy bittikten sonra Chrome DevTools'da 375px (iPhone SE) emülasyonu ile kontrol et:

- [ ] Müdür dashboard'u — stat kartları dikey sıralı
- [ ] Öğretmen dashboard — 3 kart dikey sıralı
- [ ] Not defteri sınıf sayfası — sadece öğrenci adı + son sütun görünür
- [ ] Günlük plan formu — alanlar tek sütunda
- [ ] SOK formu — alanlar tek sütunda
- [ ] Defter kontrolü formu — alanlar tek sütunda
- [ ] Sınıf performans widget — 3 metrik dikey
- [ ] Okul seviyeleri — kademeler dikey
- [ ] MobileNavDrawer — 4 sütun, taşmıyor
- [ ] Rapor dropdown — ekran genişliğine sığıyor
- [ ] Ödevler loading — 1 sütun skeleton
- [ ] Yatay overflow yok (hiçbir sayfada `overflow-x` scroll çıkmıyor)
