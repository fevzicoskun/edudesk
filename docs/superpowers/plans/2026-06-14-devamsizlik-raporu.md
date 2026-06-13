# Devamsızlık Raporu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Müdür ve müdür yardımcısına tüm okulu kapsayan, MEB sınırlarına göre renklendirilmiş devamsızlık raporu sayfası + Excel export ekle.

**Architecture:** Pure fonksiyonlar (`absenceReport.ts`) TDD ile önce yazılır; server component (`page.tsx`) bu fonksiyonları kullanarak veriyi işler ve render eder; ayrı bir GET route Excel üretir. Sidebar'a tek bir nav item eklenir.

**Tech Stack:** Next.js App Router (server component), Tailwind v4, ExcelJS (mevcut), Vitest, `countAbsences()` (mevcut), `schoolYearStart()` (mevcut).

---

## Dosya Haritası

### Yeni dosyalar
- `src/domains/attendance/lib/absenceReport.ts` — pure fonksiyonlar: `getRisk`, `buildReportRows`, `buildExcelRows`
- `tests/vitest/unit/attendance/absenceReport.test.ts` — `getRisk` + `buildReportRows` testleri (~10 test)
- `tests/vitest/unit/attendance/devamsizlikExcel.test.ts` — `buildExcelRows` testleri (~8 test)
- `app/(dashboard)/rapor/devamsizlik/page.tsx` — server component, RBAC + render
- `app/(dashboard)/rapor/devamsizlik/DevamsizlikExcelButton.tsx` — `'use client'` Excel butonu
- `app/api/rapor/devamsizlik/route.ts` — GET, Excel dosyası üretip döner

### Değişen dosyalar
- `components/layout/Sidebar.tsx` — `navItems` dizisine 1 giriş eklenir

---

## Task 1: Pure Fonksiyonlar + Testler

**Files:**
- Create: `src/domains/attendance/lib/absenceReport.ts`
- Create: `tests/vitest/unit/attendance/absenceReport.test.ts`
- Create: `tests/vitest/unit/attendance/devamsizlikExcel.test.ts`

- [ ] **Step 1: Test dosyasını oluştur**

```typescript
// tests/vitest/unit/attendance/absenceReport.test.ts
import { describe, it, expect } from 'vitest'
import { getRisk, buildReportRows } from '@/src/domains/attendance/lib/absenceReport'
import type { StudentMeta } from '@/src/domains/attendance/lib/absenceReport'

const mkStudent = (id: string, fullName: string, className = '9-A'): StudentMeta => ({
  id, fullName, studentNo: null, className,
})

describe('getRisk()', () => {
  it('14.5 → takip', () => expect(getRisk(14.5)).toBe('takip'))
  it('15 → uyari', ()  => expect(getRisk(15)).toBe('uyari'))
  it('19.5 → uyari', () => expect(getRisk(19.5)).toBe('uyari'))
  it('20 → tehlike', () => expect(getRisk(20)).toBe('tehlike'))
  it('0 → takip', ()  => expect(getRisk(0)).toBe('takip'))
  it('25 → tehlike', () => expect(getRisk(25)).toBe('tehlike'))
})

describe('buildReportRows()', () => {
  it('her ikisi sıfır → hariç', () => {
    expect(buildReportRows({ s1: { unexcused: 0, excused: 0 } }, [mkStudent('s1', 'Ali')])).toHaveLength(0)
  })

  it('sadece excused > 0 → dahil, risk=takip', () => {
    const rows = buildReportRows({ s1: { unexcused: 0, excused: 3 } }, [mkStudent('s1', 'Ali')])
    expect(rows).toHaveLength(1)
    expect(rows[0].risk).toBe('takip')
  })

  it('counts içinde olmayan öğrenci → hariç', () => {
    expect(buildReportRows({}, [mkStudent('s1', 'Ali')])).toHaveLength(0)
  })

  it('unexcused DESC sıralanır', () => {
    const counts = { s1: { unexcused: 10, excused: 0 }, s2: { unexcused: 20, excused: 0 } }
    const rows = buildReportRows(counts, [mkStudent('s1', 'Ali'), mkStudent('s2', 'Berk')])
    expect(rows[0].studentId).toBe('s2')
  })

  it('eşit unexcused → fullName ASC', () => {
    const counts = { s1: { unexcused: 15, excused: 0 }, s2: { unexcused: 15, excused: 0 } }
    const rows = buildReportRows(counts, [mkStudent('s1', 'Zeynep'), mkStudent('s2', 'Ahmet')])
    expect(rows[0].fullName).toBe('Ahmet')
  })

  it('boş input → boş dizi', () => {
    expect(buildReportRows({}, [])).toHaveLength(0)
  })

  it('risk alanları doğru atanır', () => {
    const counts = {
      s1: { unexcused: 20, excused: 0 },
      s2: { unexcused: 15, excused: 0 },
      s3: { unexcused: 5,  excused: 0 },
    }
    const rows = buildReportRows(counts, [mkStudent('s1', 'A'), mkStudent('s2', 'B'), mkStudent('s3', 'C')])
    expect(rows.find(r => r.studentId === 's1')?.risk).toBe('tehlike')
    expect(rows.find(r => r.studentId === 's2')?.risk).toBe('uyari')
    expect(rows.find(r => r.studentId === 's3')?.risk).toBe('takip')
  })
})
```

- [ ] **Step 2: Testleri çalıştır — FAIL bekleniyor**

```
npx vitest run tests/vitest/unit/attendance/absenceReport.test.ts
```
Beklenen: `Cannot find module '@/src/domains/attendance/lib/absenceReport'`

- [ ] **Step 3: absenceReport.ts oluştur**

```typescript
// src/domains/attendance/lib/absenceReport.ts
import { ATTENDANCE_WARN_DAYS, ATTENDANCE_LIMIT_DAYS } from '@/src/shared/constants/attendance'
import type { AbsenceCount } from '../types'

export type RaporRow = {
  studentId:  string
  fullName:   string
  studentNo:  string | null
  className:  string
  unexcused:  number
  excused:    number
  risk:       'tehlike' | 'uyari' | 'takip'
}

export type StudentMeta = {
  id:        string
  fullName:  string
  studentNo: string | null
  className: string
}

export function getRisk(unexcused: number): 'tehlike' | 'uyari' | 'takip' {
  if (unexcused >= ATTENDANCE_LIMIT_DAYS) return 'tehlike'
  if (unexcused >= ATTENDANCE_WARN_DAYS)  return 'uyari'
  return 'takip'
}

export function buildReportRows(
  counts:   Record<string, AbsenceCount>,
  students: StudentMeta[]
): RaporRow[] {
  return students
    .filter(s => {
      const c = counts[s.id]
      return c && (c.unexcused > 0 || c.excused > 0)
    })
    .map(s => {
      const c = counts[s.id]!
      return {
        studentId: s.id,
        fullName:  s.fullName,
        studentNo: s.studentNo,
        className: s.className,
        unexcused: c.unexcused,
        excused:   c.excused,
        risk:      getRisk(c.unexcused),
      }
    })
    .sort((a, b) => {
      if (b.unexcused !== a.unexcused) return b.unexcused - a.unexcused
      return a.fullName.localeCompare(b.fullName, 'tr')
    })
}

const RISK_EXCEL_LABELS: Record<RaporRow['risk'], string> = {
  tehlike: 'Tehlike',
  uyari:   'Uyarı',
  takip:   'Takipte',
}

export function buildExcelRows(rows: RaporRow[]): Record<string, unknown>[] {
  return rows.map((r, i) => ({
    'Sıra':        i + 1,
    'Ad Soyad':    r.fullName,
    'Numara':      r.studentNo ?? '—',
    'Sınıf':       r.className,
    'Özürsüz Gün': `${r.unexcused}g`,
    'Özürlü Gün':  `${r.excused}g`,
    'Durum':       RISK_EXCEL_LABELS[r.risk],
  }))
}
```

- [ ] **Step 4: absenceReport testlerini çalıştır — PASS bekleniyor**

```
npx vitest run tests/vitest/unit/attendance/absenceReport.test.ts
```
Beklenen: tüm testler geçer

- [ ] **Step 5: Excel test dosyasını oluştur**

```typescript
// tests/vitest/unit/attendance/devamsizlikExcel.test.ts
import { describe, it, expect } from 'vitest'
import { buildExcelRows } from '@/src/domains/attendance/lib/absenceReport'
import type { RaporRow } from '@/src/domains/attendance/lib/absenceReport'

const base: RaporRow = {
  studentId: 's1', fullName: 'Ali Yılmaz', studentNo: '101',
  className: '9-A', unexcused: 22, excused: 1, risk: 'tehlike',
}

describe('buildExcelRows()', () => {
  it('unexcused=22 → "22g"', () => {
    expect(buildExcelRows([base])[0]['Özürsüz Gün']).toBe('22g')
  })

  it('excused=0 → "0g"', () => {
    expect(buildExcelRows([{ ...base, excused: 0 }])[0]['Özürlü Gün']).toBe('0g')
  })

  it('tehlike → "Tehlike"', () => {
    expect(buildExcelRows([base])[0]['Durum']).toBe('Tehlike')
  })

  it('uyari → "Uyarı"', () => {
    expect(buildExcelRows([{ ...base, unexcused: 15, risk: 'uyari' }])[0]['Durum']).toBe('Uyarı')
  })

  it('takip → "Takipte"', () => {
    expect(buildExcelRows([{ ...base, unexcused: 5, risk: 'takip' }])[0]['Durum']).toBe('Takipte')
  })

  it('Sıra 1\'den başlar', () => {
    expect(buildExcelRows([base])[0]['Sıra']).toBe(1)
  })

  it('boş liste → boş dizi', () => {
    expect(buildExcelRows([])).toHaveLength(0)
  })

  it('studentNo null → "—"', () => {
    expect(buildExcelRows([{ ...base, studentNo: null }])[0]['Numara']).toBe('—')
  })
})
```

- [ ] **Step 6: Excel testlerini çalıştır — PASS bekleniyor**

```
npx vitest run tests/vitest/unit/attendance/devamsizlikExcel.test.ts
```
Beklenen: 8 test geçer

- [ ] **Step 7: Commit**

```bash
git add src/domains/attendance/lib/absenceReport.ts \
        tests/vitest/unit/attendance/absenceReport.test.ts \
        tests/vitest/unit/attendance/devamsizlikExcel.test.ts
git commit -m "feat(attendance): absenceReport pure fonksiyonlar + 18 unit test"
```

---

## Task 2: Sidebar Nav Item

**Files:**
- Modify: `components/layout/Sidebar.tsx`

- [ ] **Step 1: navItems dizisine rapor linkini ekle**

`components/layout/Sidebar.tsx` dosyasında `navItems` dizisinde `'/kullanicilar'` girdisinden **hemen önce** şunu ekle:

```typescript
  {
    href: '/rapor/devamsizlik',
    label: 'Devamsızlık Raporu',
    mobile: false,
    roles: ['mudur', 'mudur_yardimcisi'],
    icon: <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
  },
```

- [ ] **Step 2: TypeScript kontrolü**

```
npx tsc --noEmit
```
Beklenen: 0 hata

- [ ] **Step 3: Commit**

```bash
git add components/layout/Sidebar.tsx
git commit -m "feat(nav): devamsizlik raporu sidebar linki (mudur/mudur_yardimcisi)"
```

---

## Task 3: Excel Butonu

**Files:**
- Create: `app/(dashboard)/rapor/devamsizlik/DevamsizlikExcelButton.tsx`

- [ ] **Step 1: Bileşeni oluştur**

```tsx
// app/(dashboard)/rapor/devamsizlik/DevamsizlikExcelButton.tsx
'use client'

export default function DevamsizlikExcelButton() {
  return (
    <button
      onClick={() => { window.location.href = '/api/rapor/devamsizlik' }}
      className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors"
    >
      <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
      </svg>
      Excel İndir
    </button>
  )
}
```

- [ ] **Step 2: TypeScript kontrolü**

```
npx tsc --noEmit
```
Beklenen: 0 hata

---

## Task 4: Server Component — Rapor Sayfası

**Files:**
- Create: `app/(dashboard)/rapor/devamsizlik/page.tsx`

- [ ] **Step 1: page.tsx oluştur**

```tsx
// app/(dashboard)/rapor/devamsizlik/page.tsx
import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/src/shared/auth'
import { createClient } from '@/src/infrastructure/supabase/server'
import { schoolYearStart } from '@/src/shared/utils'
import { countAbsences } from '@/src/domains/attendance/lib/attendanceMath'
import { buildReportRows } from '@/src/domains/attendance/lib/absenceReport'
import { ATTENDANCE_WARN_DAYS, ATTENDANCE_LIMIT_DAYS } from '@/src/shared/constants/attendance'
import DevamsizlikExcelButton from './DevamsizlikExcelButton'

const MUDUR_ROLLER = ['mudur', 'mudur_yardimcisi']

const RISK_BADGE = {
  tehlike: 'bg-red-100 text-red-700 border-red-200',
  uyari:   'bg-yellow-100 text-yellow-700 border-yellow-200',
  takip:   'bg-gray-100 text-gray-600 border-gray-200',
} as const

const RISK_LABEL = {
  tehlike: 'Tehlike',
  uyari:   'Uyarı',
  takip:   'Takipte',
} as const

export default async function DevamsizlikRaporuPage() {
  const profile = await getCurrentProfile()
  if (!profile?.school_id || !MUDUR_ROLLER.includes(profile.role)) {
    redirect('/anasayfa')
  }

  const db    = await createClient()
  const since = schoolYearStart()

  const [{ data: attRows }, { data: studentRows }] = await Promise.all([
    db.from('attendance')
      .select('student_id, status, date')
      .eq('school_id', profile.school_id)
      .gte('date', since)
      .neq('status', 'present'),
    db.from('students')
      .select('id, full_name, student_number, classes(name)')
      .eq('school_id', profile.school_id)
      .is('deleted_at', null),
  ])

  const counts   = countAbsences(attRows ?? [])
  const students = (studentRows ?? []).map(s => ({
    id:        s.id,
    fullName:  s.full_name,
    studentNo: s.student_number,
    className: (s.classes as { name: string } | null)?.name ?? '—',
  }))
  const rows = buildReportRows(counts, students)

  const tehlikeCount = rows.filter(r => r.risk === 'tehlike').length
  const uyariCount   = rows.filter(r => r.risk === 'uyari').length
  const takipCount   = rows.filter(r => r.risk === 'takip').length

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Başlık */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">Devamsızlık Raporu</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
            {since} tarihinden itibaren · Özürsüz devamsızlık sırası
          </p>
        </div>
        <DevamsizlikExcelButton />
      </div>

      {/* Özet kartlar */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-center dark:bg-red-950 dark:border-red-800">
          <p className="text-3xl font-bold text-red-700 dark:text-red-400">{tehlikeCount}</p>
          <p className="text-xs text-red-500 dark:text-red-400 mt-1">Tehlikede (≥{ATTENDANCE_LIMIT_DAYS}g)</p>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 text-center dark:bg-yellow-950 dark:border-yellow-800">
          <p className="text-3xl font-bold text-yellow-700 dark:text-yellow-400">{uyariCount}</p>
          <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">Uyarıda (≥{ATTENDANCE_WARN_DAYS}g)</p>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 text-center dark:bg-slate-800 dark:border-slate-700">
          <p className="text-3xl font-bold text-gray-700 dark:text-slate-300">{takipCount}</p>
          <p className="text-xs text-gray-400 mt-1">Takipte</p>
        </div>
      </div>

      {/* Tablo */}
      {rows.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-8 text-center">
          <p className="text-gray-400 text-sm">Bu dönemde devamsızlık kaydı bulunmuyor.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-slate-700/50 border-b border-gray-200 dark:border-slate-700">
              <tr>
                {['#', 'Ad Soyad', 'Sınıf', 'Özürsüz', 'Özürlü', 'Durum'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-slate-400 first:w-8 last:w-28">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50">
              {rows.map((r, i) => (
                <tr key={r.studentId} className="hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors">
                  <td className="px-4 py-3 text-gray-400 text-xs">{i + 1}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900 dark:text-slate-100">{r.fullName}</p>
                    {r.studentNo && (
                      <p className="text-xs text-gray-400 dark:text-slate-500">No: {r.studentNo}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-slate-300">{r.className}</td>
                  <td className="px-4 py-3 font-semibold text-gray-900 dark:text-slate-100">{r.unexcused}g</td>
                  <td className="px-4 py-3 text-gray-400 dark:text-slate-500">{r.excused}g</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${RISK_BADGE[r.risk]}`}>
                      {RISK_LABEL[r.risk]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: TypeScript kontrolü**

```
npx tsc --noEmit
```
Beklenen: 0 hata

- [ ] **Step 3: Commit**

```bash
git add app/\(dashboard\)/rapor/devamsizlik/
git commit -m "feat(rapor): devamsizlik raporu sayfasi — RBAC + liste + ozet kartlar"
```

---

## Task 5: Excel API Route

**Files:**
- Create: `app/api/rapor/devamsizlik/route.ts`

- [ ] **Step 1: Route handler oluştur**

```typescript
// app/api/rapor/devamsizlik/route.ts
import { NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { getCurrentProfile } from '@/src/shared/auth'
import { createClient } from '@/src/infrastructure/supabase/server'
import { schoolYearStart } from '@/src/shared/utils'
import { countAbsences } from '@/src/domains/attendance/lib/attendanceMath'
import { buildReportRows, buildExcelRows } from '@/src/domains/attendance/lib/absenceReport'

const MUDUR_ROLLER = ['mudur', 'mudur_yardimcisi']

export async function GET() {
  const profile = await getCurrentProfile()
  if (!profile?.school_id || !MUDUR_ROLLER.includes(profile.role)) {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 })
  }

  const db    = await createClient()
  const since = schoolYearStart()

  const [{ data: attRows }, { data: studentRows }] = await Promise.all([
    db.from('attendance')
      .select('student_id, status, date')
      .eq('school_id', profile.school_id)
      .gte('date', since)
      .neq('status', 'present'),
    db.from('students')
      .select('id, full_name, student_number, classes(name)')
      .eq('school_id', profile.school_id)
      .is('deleted_at', null),
  ])

  const counts    = countAbsences(attRows ?? [])
  const students  = (studentRows ?? []).map(s => ({
    id:        s.id,
    fullName:  s.full_name,
    studentNo: s.student_number,
    className: (s.classes as { name: string } | null)?.name ?? '—',
  }))
  const rows      = buildReportRows(counts, students)
  const excelRows = buildExcelRows(rows)

  const workbook = new ExcelJS.Workbook()
  const sheet    = workbook.addWorksheet('Devamsızlık Raporu')

  if (excelRows.length === 0) {
    sheet.addRow(['Bilgi'])
    sheet.addRow(['Bu dönemde devamsızlık kaydı bulunmuyor.'])
  } else {
    const headers = Object.keys(excelRows[0])
    sheet.addRow(headers)
    const headerRow = sheet.getRow(1)
    headerRow.font = { bold: true }
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9EAD3' } }
    for (const row of excelRows) sheet.addRow(headers.map(h => row[h]))
    sheet.columns.forEach((col, i) => {
      const header  = headers[i] ?? ''
      const maxLen  = excelRows.slice(0, 50).reduce(
        (max, row) => Math.max(max, String(row[header] ?? '').length), 0
      )
      col.width = Math.min(50, Math.max(12, header.length, maxLen) + 2)
    })
  }

  const buffer = await workbook.xlsx.writeBuffer()
  return new Response(buffer as ArrayBuffer, {
    headers: {
      'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="devamsizlik-raporu.xlsx"',
    },
  })
}
```

- [ ] **Step 2: TypeScript kontrolü**

```
npx tsc --noEmit
```
Beklenen: 0 hata

- [ ] **Step 3: Commit**

```bash
git add app/api/rapor/devamsizlik/route.ts
git commit -m "feat(api): devamsizlik raporu excel export endpoint"
```

---

## Task 6: Son Doğrulama

- [ ] **Step 1: Tüm testleri çalıştır**

```
npx vitest run
```
Beklenen: tüm testler geçer (779 + 18 yeni = ~797 test)

- [ ] **Step 2: TypeScript kontrolü**

```
npx tsc --noEmit
```
Beklenen: 0 hata

- [ ] **Step 3: Manuel test — RBAC**

`npm run dev` ile dev server başlat. `ogretmen` rolüyle `/rapor/devamsizlik` aç.  
Beklenen: `/anasayfa`'ya yönlendirilir.

- [ ] **Step 4: Manuel test — Sayfa**

`mudur` rolüyle `/rapor/devamsizlik` aç.  
Beklenen: 3 özet kart görünür, tablo devamsızlığa göre sıralı, Durum badge'leri renkli.

- [ ] **Step 5: Manuel test — Excel**

"Excel İndir" butonuna tıkla.  
Beklenen: `devamsizlik-raporu.xlsx` indirilir, kolon başlıkları bold + yeşil, veriler doğru.

- [ ] **Step 6: Sidebar kontrolü**

`mudur` rolüyle sidebar'da "Devamsızlık Raporu" linkini gör.  
`ogretmen` rolüyle sidebar'da bu link görünmez.

- [ ] **Step 7: Push**

```bash
git push origin main
```
