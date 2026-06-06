# Ödev Yükü Dengesi Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ödev oluştururken/düzenlerken seçilen sınıf(lar) için o haftaki toplam ödev sayısını göster; 3+ amber, 5+ kırmızı uyarı ver.

**Architecture:** Saf hesaplama fonksiyonu (`week-load.ts`) + server action (`getClassWeekLoad`) + form UI değişiklikleri. Yalnızca READ — başka öğretmenin ödevini değiştirme imkânı sıfır (ID dönmüyor, sadece konu + tarih + öğretmen adı).

**Tech Stack:** Next.js App Router, React `useEffect`, Supabase, date-fns (zaten kurulu), Vitest

---

## Dosya Haritası

| Dosya | İşlem | Sorumluluk |
|-------|--------|------------|
| `src/domains/homework/lib/week-load.ts` | YENİ | Saf fonksiyonlar: `weekRange`, `buildClassWeekLoad` |
| `tests/vitest/unit/homework/week-load.test.ts` | YENİ | Unit testler |
| `app/actions/homework.ts` | DEĞİŞTİR | `getClassWeekLoad` server action ekle |
| `app/(dashboard)/odevler/yeni/HomeworkForm.tsx` | DEĞİŞTİR | Controlled `dueDate`, fetch hook, `WeekLoadBanner` |
| `app/(dashboard)/odevler/[id]/duzenle/page.tsx` | DEĞİŞTİR | class_id select'e ekle, form'a geçir |
| `app/(dashboard)/odevler/[id]/duzenle/OdevDuzenleForm.tsx` | DEĞİŞTİR | classId prop, fetch hook, `WeekLoadBanner` |

---

## Task 1: Saf Fonksiyonlar + Unit Testler

**Files:**
- Create: `src/domains/homework/lib/week-load.ts`
- Create: `tests/vitest/unit/homework/week-load.test.ts`

- [ ] **Step 1: Failing testleri yaz**

```typescript
// tests/vitest/unit/homework/week-load.test.ts
import { describe, it, expect } from 'vitest'
import { weekRange, buildClassWeekLoad } from '@/src/domains/homework/lib/week-load'

describe('weekRange()', () => {
  it('Pazartesi gününün haftası → Pzt–Paz', () => {
    expect(weekRange('2026-06-01')).toEqual({ start: '2026-06-01', end: '2026-06-07' })
  })
  it('Pazar gününden hafta başı bulunur', () => {
    expect(weekRange('2026-06-07')).toEqual({ start: '2026-06-01', end: '2026-06-07' })
  })
  it('Perşembe gününden hafta başı bulunur', () => {
    expect(weekRange('2026-06-04')).toEqual({ start: '2026-06-01', end: '2026-06-07' })
  })
  it('Sonraki hafta Pazartesi', () => {
    expect(weekRange('2026-06-08')).toEqual({ start: '2026-06-08', end: '2026-06-14' })
  })
  it('Yıl sonu/başı geçişi', () => {
    expect(weekRange('2026-12-31')).toEqual({ start: '2026-12-28', end: '2027-01-03' })
  })
})

describe('buildClassWeekLoad()', () => {
  const raw = (subject: string, dueDate: string, teacherId: string) => ({
    subject,
    due_date: dueDate,
    teacher_id: teacherId,
    teacher_name: `Öğretmen ${teacherId}`,
  })

  it('ödev yok → count=0, level=ok', () => {
    const result = buildClassWeekLoad([], 'c1', '5/A', 't1')
    expect(result).toEqual({ classId: 'c1', className: '5/A', count: 0, items: [], level: 'ok' })
  })

  it('2 ödev → level=ok', () => {
    const result = buildClassWeekLoad(
      [raw('Matematik', '2026-06-02', 't1'), raw('Türkçe', '2026-06-03', 't2')],
      'c1', '5/A', 't1',
    )
    expect(result.count).toBe(2)
    expect(result.level).toBe('ok')
  })

  it('3 ödev → level=warn', () => {
    const rows = ['Matematik', 'Türkçe', 'Fen'].map((s, i) => raw(s, `2026-06-0${i + 1}`, 't1'))
    expect(buildClassWeekLoad(rows, 'c1', '5/A', 't1').level).toBe('warn')
  })

  it('5 ödev → level=danger', () => {
    const rows = ['Mat', 'Tür', 'Fen', 'Sos', 'İng'].map((s, i) => raw(s, `2026-06-0${i + 1}`, 't1'))
    expect(buildClassWeekLoad(rows, 'c1', '5/A', 't1').level).toBe('danger')
  })

  it('kendi ödevi → isOwn=true', () => {
    const result = buildClassWeekLoad([raw('Mat', '2026-06-01', 'me')], 'c1', '5/A', 'me')
    expect(result.items[0].isOwn).toBe(true)
  })

  it('başka öğretmenin ödevi → isOwn=false', () => {
    const result = buildClassWeekLoad([raw('Mat', '2026-06-01', 'other')], 'c1', '5/A', 'me')
    expect(result.items[0].isOwn).toBe(false)
  })

  it('items tarihe göre sıralı', () => {
    const rows = [
      raw('Fen', '2026-06-05', 't1'),
      raw('Mat', '2026-06-01', 't1'),
      raw('Tür', '2026-06-03', 't1'),
    ]
    const result = buildClassWeekLoad(rows, 'c1', '5/A', 't1')
    expect(result.items.map(i => i.subject)).toEqual(['Mat', 'Tür', 'Fen'])
  })

  it('ID dönmez — başka öğretmenin ödevine navigate edilemez', () => {
    const result = buildClassWeekLoad([raw('Mat', '2026-06-01', 'other')], 'c1', '5/A', 'me')
    expect((result.items[0] as Record<string, unknown>).id).toBeUndefined()
  })
})
```

- [ ] **Step 2: Testleri çalıştır, hepsinin FAIL ettiğini doğrula**

```bash
npx vitest run tests/vitest/unit/homework/week-load.test.ts
```
Expected: `Cannot find module '@/src/domains/homework/lib/week-load'`

- [ ] **Step 3: Saf fonksiyonları yaz**

```typescript
// src/domains/homework/lib/week-load.ts

export type WeekLoadItem = {
  subject: string
  dueDate: string
  teacherName: string
  isOwn: boolean
}

export type ClassWeekLoad = {
  classId: string
  className: string
  count: number
  items: WeekLoadItem[]
  level: 'ok' | 'warn' | 'danger'
}

export function weekRange(dateStr: string): { start: string; end: string } {
  const [year, month, day] = dateStr.split('-').map(Number)
  const d = new Date(year, month - 1, day)
  const dow = d.getDay()                    // 0=Pazar
  const toMonday = dow === 0 ? -6 : 1 - dow
  const monday = new Date(year, month - 1, day + toMonday)
  const sunday = new Date(year, month - 1, day + toMonday + 6)
  const pad = (n: number) => String(n).padStart(2, '0')
  const fmt = (dt: Date) =>
    `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`
  return { start: fmt(monday), end: fmt(sunday) }
}

export function buildClassWeekLoad(
  rawItems: { subject: string; due_date: string; teacher_id: string; teacher_name: string }[],
  classId: string,
  className: string,
  ownTeacherId: string,
): ClassWeekLoad {
  const items: WeekLoadItem[] = rawItems
    .map(r => ({
      subject: r.subject,
      dueDate: r.due_date,
      teacherName: r.teacher_name,
      isOwn: r.teacher_id === ownTeacherId,
    }))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  const count = items.length
  return {
    classId,
    className,
    count,
    items,
    level: count >= 5 ? 'danger' : count >= 3 ? 'warn' : 'ok',
  }
}
```

- [ ] **Step 4: Testleri çalıştır, hepsinin PASS ettiğini doğrula**

```bash
npx vitest run tests/vitest/unit/homework/week-load.test.ts
```
Expected: `Tests 10 passed (10)`

- [ ] **Step 5: Commit**

```bash
git add src/domains/homework/lib/week-load.ts tests/vitest/unit/homework/week-load.test.ts
git commit -m "feat(homework): weekRange + buildClassWeekLoad saf fonksiyonlar + testler"
```

---

## Task 2: Server Action `getClassWeekLoad`

**Files:**
- Modify: `app/actions/homework.ts`

- [ ] **Step 1: `app/actions/homework.ts` dosyasının başına import ekle**

Dosyanın başında (`'use server'` satırından sonra) mevcut import bloğunu bul ve şunu ekle:

```typescript
import { weekRange, buildClassWeekLoad, type ClassWeekLoad } from '@/src/domains/homework/lib/week-load'
```

`getCurrentUser` zaten import edilmiş durumda — değişiklik yok.

- [ ] **Step 2: Dosyanın sonuna `getClassWeekLoad` action'ını ekle**

```typescript
export async function getClassWeekLoad(
  classIds: string[],
  weekOf: string,
): Promise<ClassWeekLoad[]> {
  if (!classIds.length || !weekOf) return []

  const [user, profile, supabase] = await Promise.all([
    getCurrentUser(),
    getCurrentProfile(),
    createClient(),
  ])
  if (!user || !profile?.school_id) return []

  const { start, end } = weekRange(weekOf)

  const { data } = await supabase
    .from('homeworks')
    .select('subject, due_date, class_id, teacher_id, teacher:profiles(full_name), classes(id, name)')
    .eq('school_id', profile.school_id)
    .in('class_id', classIds)
    .eq('is_template', false)
    .is('deleted_at', null)
    .gte('due_date', start)
    .lte('due_date', end)

  if (!data) return []

  // Sınıf adı haritası
  const classNameMap = new Map<string, string>()
  for (const hw of data) {
    const cls = hw.classes as { id: string; name: string } | null
    if (cls) classNameMap.set(cls.id, cls.name)
  }

  return classIds.map(classId => {
    const rows = data.filter(hw => (hw.class_id as string) === classId)
    return buildClassWeekLoad(
      rows.map(hw => ({
        subject: hw.subject as string,
        due_date: hw.due_date as string,
        teacher_id: hw.teacher_id as string,
        teacher_name:
          ((hw.teacher as { full_name: string } | null)?.full_name) ?? 'Bilinmiyor',
      })),
      classId,
      classNameMap.get(classId) ?? '',
      user.id,
    )
  })
}
```

- [ ] **Step 3: TypeScript kontrolü**

```bash
npx tsc --noEmit
```
Expected: sıfır hata

- [ ] **Step 4: Tüm testleri çalıştır**

```bash
npm run test:unit -- --run
```
Expected: `170 passed` (değişmemiş)

- [ ] **Step 5: Commit**

```bash
git add app/actions/homework.ts
git commit -m "feat(homework): getClassWeekLoad server action — haftalık ödev yükü sorgulama"
```

---

## Task 3: Oluşturma Formu UI (`HomeworkForm.tsx`)

**Files:**
- Modify: `app/(dashboard)/odevler/yeni/HomeworkForm.tsx`

- [ ] **Step 1: Import ekle**

Dosyanın `'use client'` satırından sonraki import bloğuna şunu ekle:

```typescript
import { useEffect, useState } from 'react'
import { getClassWeekLoad } from '@/app/actions/homework'
import type { ClassWeekLoad } from '@/src/domains/homework/lib/week-load'
```

> Not: Mevcut `import { useActionState, useState } from 'react'` satırını `import { useActionState, useState, useEffect } from 'react'` olarak güncelle.

- [ ] **Step 2: `dueDate` controlled state ve weekLoad state ekle**

Component fonksiyonu içine, mevcut `useState` çağrılarının yanına:

```typescript
const [dueDate, setDueDate]       = useState(defaults?.due_date ?? '')
const [weekLoad, setWeekLoad]     = useState<ClassWeekLoad[]>([])
const [loadingLoad, setLoadingLoad] = useState(false)
```

- [ ] **Step 3: `useEffect` hook ekle**

`useState` bloklarının hemen altına:

```typescript
useEffect(() => {
  if (isTemplate || selectedClasses.length === 0 || !dueDate) {
    setWeekLoad([])
    return
  }
  setLoadingLoad(true)
  getClassWeekLoad(selectedClasses, dueDate).then(result => {
    setWeekLoad(result)
    setLoadingLoad(false)
  })
}, [selectedClasses, dueDate, isTemplate])
```

- [ ] **Step 4: `due_date` input'unu controlled yap**

Mevcut `<input name="due_date" ...>` satırını bul (şu an `defaultValue` var):

```tsx
{/* ESKİ */}
<input name="due_date" type="date" required={!isTemplate} min={todayISO()} className={field} defaultValue={defaults?.due_date ?? ''} />

{/* YENİ */}
<input
  name="due_date"
  type="date"
  required={!isTemplate}
  min={todayISO()}
  className={field}
  value={dueDate}
  onChange={e => setDueDate(e.target.value)}
/>
```

- [ ] **Step 5: `WeekLoadBanner` inline bileşenini dosyanın sonuna ekle (export yoktur)**

```tsx
function WeekLoadBanner({ loads, loading }: { loads: ClassWeekLoad[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-400">
        <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        Haftalık yük hesaplanıyor…
      </div>
    )
  }

  const worstLevel = loads.reduce<'ok' | 'warn' | 'danger'>((acc, l) => {
    if (l.level === 'danger') return 'danger'
    if (l.level === 'warn' && acc !== 'danger') return 'warn'
    return acc
  }, 'ok')

  if (loads.length === 0 || loads.every(l => l.count === 0)) return null

  const bg =
    worstLevel === 'danger' ? 'bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800' :
    worstLevel === 'warn'   ? 'bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800' :
                              'bg-gray-50 border-gray-200 dark:bg-slate-800 dark:border-slate-700'

  const titleColor =
    worstLevel === 'danger' ? 'text-red-700 dark:text-red-300' :
    worstLevel === 'warn'   ? 'text-amber-700 dark:text-amber-300' :
                              'text-gray-600 dark:text-slate-400'

  const icon =
    worstLevel === 'ok' ? (
      <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ) : (
      <svg className={`w-3.5 h-3.5 ${worstLevel === 'danger' ? 'text-red-500' : 'text-amber-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
      </svg>
    )

  return (
    <div className={`border rounded-xl px-3 py-2.5 space-y-2 ${bg}`}>
      <div className={`flex items-center gap-1.5 text-xs font-semibold ${titleColor}`}>
        {icon}
        Bu hafta{loads.length > 1 ? ' (seçili sınıflar)' : ''}:
        {worstLevel === 'danger' && ' ⚠️ Fazla yük!'}
        {worstLevel === 'warn'   && ' Dikkat: yük artıyor'}
        {worstLevel === 'ok'     && ' Yük uygun'}
      </div>
      <div className="space-y-1">
        {loads.filter(l => l.count > 0).map(l => (
          <div key={l.classId} className="text-xs">
            {loads.length > 1 && (
              <span className="font-medium text-gray-700 dark:text-slate-300">{l.className}: </span>
            )}
            <span className={
              l.level === 'danger' ? 'text-red-600 dark:text-red-400 font-semibold' :
              l.level === 'warn'   ? 'text-amber-600 dark:text-amber-400 font-medium' :
                                     'text-gray-500 dark:text-slate-400'
            }>
              {l.count} ödev
            </span>
            {' — '}
            <span className="text-gray-500 dark:text-slate-400">
              {l.items.map(item =>
                `${item.subject}${!item.isOwn ? ` (${item.teacherName})` : ''}`
              ).join(', ')}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Banner'ı forma ekle**

`{!isTemplate && (<div className="space-y-2">` — Son Teslim Tarihi alanının (`<div className="space-y-2">`) kapanış `</div>`'ından hemen sonra:

```tsx
{/* Son Teslim Tarihi bloğunun kapanışından sonra */}
{!isTemplate && (
  <WeekLoadBanner loads={weekLoad} loading={loadingLoad} />
)}
```

> Tam konum: `due_date` input bloğunun `</div>` kapatmasından hemen sonra, şablon toggle'dan önce.

- [ ] **Step 7: TypeScript kontrolü**

```bash
npx tsc --noEmit
```
Expected: sıfır hata

- [ ] **Step 8: Testleri çalıştır**

```bash
npm run test:unit -- --run
```
Expected: `170 passed`

- [ ] **Step 9: Commit**

```bash
git add app/(dashboard)/odevler/yeni/HomeworkForm.tsx
git commit -m "feat(homework): ödev oluşturma formuna haftalık yük uyarısı eklendi"
```

---

## Task 4: Düzenleme Formu UI (`OdevDuzenleForm.tsx`)

**Files:**
- Modify: `app/(dashboard)/odevler/[id]/duzenle/page.tsx`
- Modify: `app/(dashboard)/odevler/[id]/duzenle/OdevDuzenleForm.tsx`

- [ ] **Step 1: `page.tsx`'e `class_id` ekle**

`hwRes` sorgusundaki select string'ine `class_id` ekle:

```typescript
// ESKİ
.select('id, title, subject, description, due_date, teacher_id, source_id')

// YENİ
.select('id, title, subject, description, due_date, teacher_id, source_id, class_id')
```

`OdevDuzenleForm`'a `classId` prop'u geçir:

```tsx
// ESKİ
<OdevDuzenleForm
  hw={{ id: hw.id, title: hw.title, subject: hw.subject ?? '', description: hw.description, due_date: hw.due_date, source_id: hw.source_id }}
  sources={sourcesRes.data ?? []}
/>

// YENİ
<OdevDuzenleForm
  hw={{ id: hw.id, title: hw.title, subject: hw.subject ?? '', description: hw.description, due_date: hw.due_date, source_id: hw.source_id }}
  classId={hw.class_id as string}
  sources={sourcesRes.data ?? []}
/>
```

- [ ] **Step 2: `OdevDuzenleForm.tsx`'e import + state + effect ekle**

Dosyanın başına:

```typescript
import { useEffect, useState } from 'react'
import { getClassWeekLoad } from '@/app/actions/homework'
import type { ClassWeekLoad } from '@/src/domains/homework/lib/week-load'
```

> `useActionState` ile birlikte: `import { useActionState, useEffect, useState } from 'react'`

Component prop tipine `classId: string` ekle:

```typescript
// ESKİ
export default function OdevDuzenleForm({ hw, sources }: { hw: HwData; sources: SourceItem[] }) {

// YENİ
export default function OdevDuzenleForm({ hw, sources, classId }: { hw: HwData; sources: SourceItem[]; classId: string }) {
```

Component body'sine state + effect ekle (mevcut `useActionState` satırının altına):

```typescript
const [dueDate, setDueDate]         = useState(hw.due_date ?? '')
const [weekLoad, setWeekLoad]       = useState<ClassWeekLoad[]>([])
const [loadingLoad, setLoadingLoad] = useState(false)

useEffect(() => {
  if (!classId || !dueDate) { setWeekLoad([]); return }
  setLoadingLoad(true)
  getClassWeekLoad([classId], dueDate).then(result => {
    setWeekLoad(result)
    setLoadingLoad(false)
  })
}, [classId, dueDate])
```

- [ ] **Step 3: `due_date` input'unu controlled yap**

`OdevDuzenleForm.tsx`'teki `due_date` input'unu (satır ~51) bul:

```tsx
{/* ESKİ */}
<input
  name="due_date"
  type="date"
  className={field}
  defaultValue={hw.due_date ?? ''}
  min={...}
/>

{/* YENİ */}
<input
  name="due_date"
  type="date"
  className={field}
  value={dueDate}
  onChange={e => setDueDate(e.target.value)}
  min={hw.due_date && hw.due_date < new Date().toISOString().split('T')[0] ? undefined : new Date().toISOString().split('T')[0]}
/>
```

- [ ] **Step 4: `WeekLoadBanner`'ı dosyaya ekle ve kullan**

Task 3 Step 5'teki `WeekLoadBanner` fonksiyonunu `OdevDuzenleForm.tsx` dosyasının sonuna AYNEN kopyala (aynı kod, export yok).

Due date input'unun kapanış `</div>`'ından hemen sonra:

```tsx
<WeekLoadBanner loads={weekLoad} loading={loadingLoad} />
```

- [ ] **Step 5: TypeScript kontrolü**

```bash
npx tsc --noEmit
```
Expected: sıfır hata

- [ ] **Step 6: Tüm testleri çalıştır**

```bash
npm run test:unit -- --run
```
Expected: `170 passed`

- [ ] **Step 7: Commit + push**

```bash
git add app/(dashboard)/odevler/[id]/duzenle/page.tsx app/(dashboard)/odevler/[id]/duzenle/OdevDuzenleForm.tsx
git commit -m "feat(homework): ödev düzenleme formuna haftalık yük uyarısı eklendi"
git push origin main
```

---

## Doğrulama

1. `npm run dev` → `/odevler/yeni` sayfasına git
2. Bir sınıf seç + tarih gir → Banner görünmeli
3. Aynı haftaya 3 ödev olan bir sınıfı seç → amber uyarı
4. Başka öğretmenin ödevi varsa → `(Öğretmen Adı)` olarak görünmeli, tıklanabilir link olmamalı
5. `/odevler/{id}/duzenle` → tarih değiştir → banner güncellenmeli
6. `npm run test:unit -- --run` → `170 passed` (yeni testlerle birlikte daha fazla)
