# Öğretmen Anasayfası — Ödev Widget Yenileme

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Devamsızlık Trendi widget'ını kaldır; Ödev Tamamlanma widget'ını tam genişliğe al, sınıf tab filtresi + gerçek sayılar + tıklanabilir bar ekle.

**Architecture:** Tip değişikliği → service güncelleme → eski dosyalar silme → chart güncelleme → widget güncelleme sırasıyla ilerler. Her task sonunda `npx tsc --noEmit` çalıştırılır; hangi hataların bekleneceği açıklanır.

**Tech Stack:** Next.js App Router, React 19, TypeScript, recharts, `next/navigation` useRouter.

**Spec:** `docs/superpowers/specs/2026-06-11-ogretmen-anasayfa-odev-widget-design.md`

---

## Dosya Haritası

| Dosya | Değişiklik |
|---|---|
| `src/domains/dashboard/types.ts` | `OdevTamamlanmaItem` genişlet; `YoklamaTrendItem` + `yoklamaTrendData` kaldır |
| `src/domains/dashboard/services/TeacherDashboardService.ts` | Import düzelt; trend sorgusu + bloğu kaldır; tamamlanmaData yeniden yaz |
| `app/(dashboard)/anasayfa/OgretmenDashboard.tsx` | Trend import + kullanım kaldır; grid → full-width |
| `app/(dashboard)/anasayfa/YoklamaTrendWidget.tsx` | **SİL** |
| `app/(dashboard)/anasayfa/YoklamaTrendChart.tsx` | **SİL** |
| `app/(dashboard)/anasayfa/OdevTamamlanmaChart.tsx` | DataPoint'e id/yapildiCount/total ekle; tıklanabilir bar; gelişmiş tooltip |
| `app/(dashboard)/anasayfa/OdevTamamlanmaWidget.tsx` | Tab state + filteredData + subtitle |

---

### Task 1: `types.ts` — OdevTamamlanmaItem genişlet, yoklama trend tiplerini kaldır

**Files:**
- Modify: `src/domains/dashboard/types.ts`

- [ ] **Step 1: Dosyayı güncelle**

`src/domains/dashboard/types.ts` dosyasının tamamını aşağıdakiyle değiştir:

```ts
// src/domains/dashboard/types.ts
import type { RiskLevel } from './risk'

export type HomeworkLite = {
  id: string
  title: string
  subject: string
  due_date: string
  class_id: string
  classes: { name: string; grade: number } | null
}

export type WeeklyStats = {
  submittedCount: number
  avgCompletionPct: number
  activeRiskCount: number
}

export type OdevTamamlanmaItem = {
  id:           string   // homework id — /odevler/[id] linki için
  title:        string   // maks 14 karakter, truncated
  classId:      string   // client tab filtresi için
  className:    string   // tab label için
  yapildi:      number   // % (0-100)
  eksik:        number   // %
  diger:        number   // %
  yapildiCount: number   // gerçek tamamlayan öğrenci sayısı
  total:        number   // toplam submission sayısı
}

export type YoklamaDurumItem = {
  classId:   string
  className: string
  grade:     number
  alindi:    boolean
}

export type DashboardMetrics = {
  todayHomeworkCount: number
  totalMissingCount: number
  activeRiskCount: number
  weekly: WeeklyStats
  homeworks: HomeworkLite[]
  tamamlanmaData: OdevTamamlanmaItem[]
  yoklamaDurumu: YoklamaDurumItem[]
  riskAlerts: RiskAlert[]
}

export type RiskAlert = {
  studentId: string
  studentName: string
  classId: string
  className: string
  riskLevel: RiskLevel
  reasons: string[]
  hwMisses: number
  absences: number
}

export type ClassSummary = {
  avgCompletionPct: number
  highRiskCount: number
  totalMissingCount: number
  riskyStudents: RiskAlert[]
}
```

- [ ] **Step 2: TypeScript hata kontrolü**

Run: `npx tsc --noEmit 2>&1 | head -30`

**Beklenen:** `TeacherDashboardService.ts` ve `OgretmenDashboard.tsx`'de hatalar — bunlar sonraki task'larda düzelecek. Bu dosyalar dışında hata olmamalı.

---

### Task 2: `TeacherDashboardService.ts` — trend bloğunu kaldır, tamamlanmaData'yı yeniden yaz

**Files:**
- Modify: `src/domains/dashboard/services/TeacherDashboardService.ts`

- [ ] **Step 1: Import satırını güncelle (satır 8)**

`YoklamaTrendItem` importdan çıkar:

```ts
// ESKİ (satır 8):
import type { DashboardMetrics, RiskAlert, ClassSummary, HomeworkLite, OdevTamamlanmaItem, YoklamaTrendItem, YoklamaDurumItem } from '../types'

// YENİ:
import type { DashboardMetrics, RiskAlert, ClassSummary, HomeworkLite, OdevTamamlanmaItem, YoklamaDurumItem } from '../types'
```

- [ ] **Step 2: `shortLabel` fonksiyonunu kaldır (satır 21-25)**

Bu fonksiyon yalnızca yoklama trend bloğunda kullanılıyor. Satır 21-25'i sil:

```ts
// SİL — bu 5 satırı kaldır:
function shortLabel(isoDate: string): string {
  const d = new Date(isoDate)
  const months = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara']
  return `${d.getDate()} ${months[d.getMonth()]}`
}
```

- [ ] **Step 3: `getDashboardMetrics` içinden `eightWeeksAgo` kaldır**

`getDashboardMetrics` fonksiyonunun başındaki (satır 168-169 civarı):

```ts
// ESKİ:
const today         = todayLocalISO()
const eightWeeksAgo = turkeyDate(subDays(new Date(), 56))
const weekStart     = getWeekStart()

// YENİ:
const today     = todayLocalISO()
const weekStart = getWeekStart()
```

- [ ] **Step 4: `Promise.all` bloğundan `trendResult` kaldır (satır 181-185)**

```ts
// ESKİ:
const [weeklyResult, trendResult, todayAttResult] = await Promise.all([
  DashboardRepository.getWeeklySubmissionStats(hwIds, weekStart),
  DashboardRepository.getAttendanceTrend(classIds, eightWeeksAgo),
  DashboardRepository.getTodayClassAttendance(classIds, today),
])

// YENİ:
const [weeklyResult, todayAttResult] = await Promise.all([
  DashboardRepository.getWeeklySubmissionStats(hwIds, weekStart),
  DashboardRepository.getTodayClassAttendance(classIds, today),
])
```

- [ ] **Step 5: `trendRows` satırını kaldır (satır 189)**

```ts
// SİL:
const trendRows = (trendResult.data ?? []) as { date: string; status: string }[]
```

- [ ] **Step 6: `tamamlanmaData` bloğunu yeniden yaz (satır 202-224)**

Eski blok:
```ts
// Ödev tamamlanma chart: son 6 geçmiş ödev
const pastHws = homeworks.filter(h => h.due_date <= today).slice(0, 6)
const subByHw = new Map<string, { yapildi: number; eksik: number; diger: number; toplam: number }>()
for (const hw of pastHws) subByHw.set(hw.id, { yapildi: 0, eksik: 0, diger: 0, toplam: 0 })
for (const s of submissions) {
  const e = subByHw.get(s.homework_id)
  if (!e) continue
  e.toplam++
  if      (s.status === 'yapildi') e.yapildi++
  else if (s.status === 'eksik')   e.eksik++
  else                              e.diger++
}
const tamamlanmaData: OdevTamamlanmaItem[] = [...pastHws].reverse().map(hw => {
  const s = subByHw.get(hw.id)!
  const t = s.toplam
  const title = hw.title.length > 14 ? hw.title.slice(0, 13) + '…' : hw.title
  return {
    title,
    yapildi: t > 0 ? Math.round((s.yapildi / t) * 100) : 0,
    eksik:   t > 0 ? Math.round((s.eksik   / t) * 100) : 0,
    diger:   t > 0 ? Math.round((s.diger   / t) * 100) : 0,
  }
})
```

Yeni blok (aynı yere yaz):
```ts
// Ödev tamamlanma chart: sınıf başına son 6 geçmiş ödev (homeworks due_date DESC sıralı)
const pastHwByClass = new Map<string, HwRow[]>()
for (const hw of homeworks) {
  if (hw.due_date > today) continue
  const list = pastHwByClass.get(hw.class_id) ?? []
  if (list.length < 6) {
    list.push(hw)
    pastHwByClass.set(hw.class_id, list)
  }
}
const pastHws: HwRow[] = [...pastHwByClass.values()].flat()
  .sort((a, b) => a.due_date.localeCompare(b.due_date))  // eskiden yeniye

const subByHw = new Map<string, { yapildi: number; eksik: number; diger: number; toplam: number }>()
for (const hw of pastHws) subByHw.set(hw.id, { yapildi: 0, eksik: 0, diger: 0, toplam: 0 })
for (const s of submissions) {
  const e = subByHw.get(s.homework_id)
  if (!e) continue
  e.toplam++
  if      (s.status === 'yapildi') e.yapildi++
  else if (s.status === 'eksik')   e.eksik++
  else                             e.diger++
}
const tamamlanmaData: OdevTamamlanmaItem[] = pastHws.map(hw => {
  const s = subByHw.get(hw.id) ?? { yapildi: 0, eksik: 0, diger: 0, toplam: 0 }
  const t = s.toplam
  const title = hw.title.length > 14 ? hw.title.slice(0, 13) + '…' : hw.title
  return {
    id:           hw.id,
    title,
    classId:      hw.class_id,
    className:    hw.classes?.name ?? '—',
    yapildi:      t > 0 ? Math.round((s.yapildi / t) * 100) : 0,
    eksik:        t > 0 ? Math.round((s.eksik   / t) * 100) : 0,
    diger:        t > 0 ? Math.round((s.diger   / t) * 100) : 0,
    yapildiCount: s.yapildi,
    total:        t,
  }
})
```

- [ ] **Step 7: Yoklama trend bloğunu sil (satır 226-242)**

Aşağıdaki bloku tamamen kaldır:
```ts
// Yoklama trend chart: son 8 hafta
const weekMap = new Map<string, { devamsiz: number; toplam: number }>()
for (const r of trendRows) {
  const key = mondayOf(r.date)
  if (!weekMap.has(key)) weekMap.set(key, { devamsiz: 0, toplam: 0 })
  const e = weekMap.get(key)!
  e.toplam++
  if (r.status === 'absent') e.devamsiz++
}
const yoklamaTrendData: YoklamaTrendItem[] = Array.from(weekMap.entries())
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([week, { devamsiz, toplam }]) => ({
    hafta: shortLabel(week),
    oran:  toplam > 0 ? Math.round((devamsiz / toplam) * 100) : 0,
    devamsiz,
    toplam,
  }))
```

- [ ] **Step 8: Return nesnesinden `yoklamaTrendData` kaldır**

```ts
// ESKİ (return içinde):
      tamamlanmaData,
      yoklamaTrendData,
      yoklamaDurumu,

// YENİ:
      tamamlanmaData,
      yoklamaDurumu,
```

- [ ] **Step 9: TypeScript hata kontrolü**

Run: `npx tsc --noEmit 2>&1 | head -30`

**Beklenen:** Yalnızca `OgretmenDashboard.tsx`'de `yoklamaTrendData` kullanımına ait hata. Başka dosyada hata olmamalı.

---

### Task 3: `OgretmenDashboard.tsx` güncelle + trend dosyalarını sil

**Files:**
- Modify: `app/(dashboard)/anasayfa/OgretmenDashboard.tsx`
- Delete: `app/(dashboard)/anasayfa/YoklamaTrendWidget.tsx`
- Delete: `app/(dashboard)/anasayfa/YoklamaTrendChart.tsx`

- [ ] **Step 1: `YoklamaTrendWidget` importunu kaldır**

`OgretmenDashboard.tsx` satır 8:
```ts
// SİL:
import YoklamaTrendWidget from './YoklamaTrendWidget'
```

- [ ] **Step 2: Grid'i full-width'e çevir (satır 107-111)**

```tsx
// ESKİ:
      {/* Analitik Widgetlar */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <YoklamaTrendWidget data={metrics.yoklamaTrendData} />
        <OdevTamamlanmaWidget data={metrics.tamamlanmaData} />
      </div>

// YENİ:
      {/* Analitik Widgetlar */}
      <div className="mb-4">
        <OdevTamamlanmaWidget data={metrics.tamamlanmaData} />
      </div>
```

- [ ] **Step 3: Trend dosyalarını sil**

```bash
rm "app/(dashboard)/anasayfa/YoklamaTrendWidget.tsx"
rm "app/(dashboard)/anasayfa/YoklamaTrendChart.tsx"
```

- [ ] **Step 4: TypeScript hata ve test kontrolü**

Run: `npx tsc --noEmit`
Expected: **0 hata**

Run: `npm run test:unit`
Expected: **Tüm testler geçiyor** (409)

- [ ] **Step 5: Commit**

```bash
git add src/domains/dashboard/types.ts
git add src/domains/dashboard/services/TeacherDashboardService.ts
git add app/(dashboard)/anasayfa/OgretmenDashboard.tsx
git rm app/(dashboard)/anasayfa/YoklamaTrendWidget.tsx
git rm app/(dashboard)/anasayfa/YoklamaTrendChart.tsx
git commit -m "refactor(dashboard): yoklama trend kaldir, tamamlanma verisini sinif bazinda genislet"
```

---

### Task 4: `OdevTamamlanmaChart.tsx` — tıklanabilir bar + gerçek sayı tooltip

**Files:**
- Modify: `app/(dashboard)/anasayfa/OdevTamamlanmaChart.tsx`

- [ ] **Step 1: Dosyayı güncelle**

Mevcut dosyanın tamamını aşağıdakiyle değiştir:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'

type DataPoint = {
  id:           string
  title:        string
  yapildi:      number
  eksik:        number
  diger:        number
  yapildiCount: number
  total:        number
}

function useIsDark() {
  const [dark, setDark] = useState(false)
  useEffect(() => {
    const check = () => setDark(document.documentElement.classList.contains('dark'))
    check()
    const obs = new MutationObserver(check)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])
  return dark
}

const LABEL: Record<string, string> = { yapildi: 'Yapıldı', eksik: 'Eksik', diger: 'Yapılmadı' }

export default function OdevTamamlanmaChart({ data }: { data: DataPoint[] }) {
  const isDark  = useIsDark()
  const router  = useRouter()

  const gridColor  = isDark ? '#334155' : '#e5e7eb'
  const textColor  = isDark ? '#94a3b8' : '#9ca3af'
  const tooltipBg  = isDark ? '#1e293b' : '#ffffff'
  const tooltipBrd = isDark ? '#334155' : '#e5e7eb'
  const tooltipTxt = isDark ? '#e2e8f0' : '#374151'

  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart
        data={data}
        margin={{ top: 4, right: 4, left: -18, bottom: 0 }}
        style={{ cursor: 'pointer' }}
        onClick={(chartData) => {
          if (!chartData?.activePayload?.[0]) return
          const item = chartData.activePayload[0].payload as DataPoint
          if (item.id) router.push(`/odevler/${item.id}`)
        }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
        <XAxis
          dataKey="title"
          tick={{ fontSize: 9, fill: textColor }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 10, fill: textColor }}
          axisLine={false}
          tickLine={false}
          tickFormatter={v => `${v}%`}
          domain={[0, 100]}
          width={32}
        />
        <Tooltip
          contentStyle={{
            background: tooltipBg,
            border: `1px solid ${tooltipBrd}`,
            borderRadius: '0.5rem',
            fontSize: '12px',
            color: tooltipTxt,
          }}
          formatter={(value, name, item) => {
            const label = LABEL[String(name)] ?? String(name)
            if (String(name) === 'yapildi') {
              const pt = item.payload as DataPoint
              if (pt.total > 0) {
                return [`%${value} (${pt.yapildiCount}/${pt.total})`, label] as [string, string]
              }
            }
            return [`%${value}`, label] as [string, string]
          }}
          labelStyle={{ fontWeight: 600, marginBottom: 2 }}
        />
        <Bar dataKey="yapildi" name="Yapıldı"    stackId="a" fill="#22c55e" />
        <Bar dataKey="eksik"   name="Eksik"      stackId="a" fill="#f59e0b" />
        <Bar dataKey="diger"   name="Yapılmadı"  stackId="a" fill="#ef4444" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
```

- [ ] **Step 2: TypeScript hata kontrolü**

Run: `npx tsc --noEmit`
Expected: **0 hata**

Not: Widget hâlâ `OdevTamamlanmaItem[]` geçiyor. `OdevTamamlanmaItem`, `DataPoint`'in tüm alanlarını kapsıyor (structural typing) — TypeScript kabul eder.

- [ ] **Step 3: Commit**

```bash
git add app/(dashboard)/anasayfa/OdevTamamlanmaChart.tsx
git commit -m "feat(dashboard): odev chart — tiklanabilir bar, gercek sayi tooltip"
```

---

### Task 5: `OdevTamamlanmaWidget.tsx` — tab filtresi + dinamik alt başlık

**Files:**
- Modify: `app/(dashboard)/anasayfa/OdevTamamlanmaWidget.tsx`

- [ ] **Step 1: Dosyayı güncelle**

Mevcut dosyanın tamamını aşağıdakiyle değiştir:

```tsx
'use client'

import { useState, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { OdevTamamlanmaItem } from '@/src/domains/dashboard/types'

const OdevTamamlanmaChart = dynamic(() => import('./OdevTamamlanmaChart'), { ssr: false })

function TabButton({
  id, label, selected, onSelect,
}: {
  id: string
  label: string
  selected: string
  onSelect: (id: string) => void
}) {
  const active = selected === id
  return (
    <button
      onClick={() => onSelect(id)}
      className={`text-[11px] font-medium px-2.5 py-1 rounded-full border transition-colors ${
        active
          ? 'bg-blue-600 text-white border-blue-600'
          : 'bg-white dark:bg-slate-800 text-gray-500 dark:text-slate-400 border-gray-200 dark:border-slate-700 hover:border-blue-400'
      }`}
    >
      {label}
    </button>
  )
}

export default function OdevTamamlanmaWidget({ data }: { data: OdevTamamlanmaItem[] }) {
  const [selectedClass, setSelectedClass] = useState('')

  // Unique sınıf listesi — className'e göre sıralı
  const classes = useMemo(() => {
    const map = new Map<string, string>()
    for (const d of data) map.set(d.classId, d.className)
    return [...map.entries()]
      .map(([classId, className]) => ({ classId, className }))
      .sort((a, b) => a.className.localeCompare(b.className, 'tr'))
  }, [data])

  // Seçili tab'a göre gösterilecek veri
  // data eskiden yeniye sıralı (service'te .sort due_date ASC yapıldı)
  // "Tümü" → son 8; per-class → o sınıfın tüm 6 kalemi
  const filteredData = useMemo(() => {
    if (selectedClass === '') return data.slice(-8)
    return data.filter(d => d.classId === selectedClass)
  }, [data, selectedClass])

  // Alt başlık hesabı
  const subtitle = useMemo(() => {
    const count = filteredData.length
    if (count === 0) return ''
    const classLabel =
      selectedClass === ''
        ? 'Tüm sınıflar'
        : (classes.find(c => c.classId === selectedClass)?.className ?? '')
    const totalDone     = filteredData.reduce((sum, d) => sum + d.yapildiCount, 0)
    const totalStudents = filteredData.reduce((sum, d) => sum + d.total, 0)
    const avgPct        = Math.round(
      filteredData.reduce((sum, d) => sum + d.yapildi, 0) / count,
    )
    const countLabel = `Son ${count} ödev`
    if (totalStudents === 0) return `${countLabel} · ${classLabel}`
    return `${countLabel} · ${classLabel} · ort. %${avgPct} · ${totalDone}/${totalStudents} öğrenci`
  }, [filteredData, selectedClass, classes])

  return (
    <Card className="border-gray-200 dark:border-slate-700 shadow-sm">
      <CardHeader className="pb-1">
        <CardTitle className="text-sm font-semibold text-gray-700 dark:text-slate-300">
          Ödev Tamamlanma Oranları
        </CardTitle>
        {subtitle && (
          <p className="text-xs text-gray-400 dark:text-slate-500">{subtitle}</p>
        )}
      </CardHeader>

      {/* Sınıf tab'ları — birden fazla sınıf varsa göster */}
      {classes.length > 1 && (
        <div className="px-4 pb-2 flex gap-1.5 flex-wrap">
          <TabButton id="" label="Tümü" selected={selectedClass} onSelect={setSelectedClass} />
          {classes.map(c => (
            <TabButton
              key={c.classId}
              id={c.classId}
              label={c.className}
              selected={selectedClass}
              onSelect={setSelectedClass}
            />
          ))}
        </div>
      )}

      <CardContent className="pt-2 pb-4">
        {filteredData.length === 0 ? (
          <div className="h-40 flex items-center justify-center text-sm text-gray-400 dark:text-slate-500">
            Geçmiş ödev bulunamadı.
          </div>
        ) : (
          <OdevTamamlanmaChart data={filteredData} />
        )}
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: TypeScript hata kontrolü**

Run: `npx tsc --noEmit`
Expected: **0 hata**

- [ ] **Step 3: Unit testleri çalıştır**

Run: `npm run test:unit`
Expected: **Tüm testler geçiyor** (tip değişikliği hiçbir unit testi kırmıyor)

- [ ] **Step 4: Production build**

Run: `npm run build`
Expected: Build başarıyla tamamlanıyor, hata yok

- [ ] **Step 5: Commit + push**

```bash
git add app/(dashboard)/anasayfa/OdevTamamlanmaWidget.tsx
git commit -m "feat(dashboard): odev widget — sinif tab filtresi, dinamik alt baslik"
git push origin main
```

---

## Görev Bağımlılıkları

```
Task 1 (types) → Task 2 (service) → Task 3 (OgretmenDashboard + silme) → Task 4 (chart) → Task 5 (widget)
```

Her task sırayla yapılmalı — aralarında paralel çalışma yok.
