# Sınıf Ödev Matrisi Filtre ve Sıralama — Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sınıf ödev matrisi sayfasına öğrenci arama ve tamamlanma oranına göre sıralama ekle.

**Architecture:** Server component veri çekmeye devam eder; tablo rendering yeni `MatrisClient.tsx` client bileşenine taşınır. Client-side state ile anlık filtre/sıralama — ek DB sorgusu yok.

**Tech Stack:** Next.js App Router, React `useState`, TypeScript, Tailwind v4

---

## Dosya Haritası

| Dosya | Değişiklik |
|-------|-----------|
| `app/(dashboard)/odevler/sinif/[classId]/MatrisClient.tsx` | YENİ — tablo + filtre/sıralama kontrolleri |
| `app/(dashboard)/odevler/sinif/[classId]/page.tsx` | DEĞİŞTİR — `subMap` build et, `MatrisClient`'a geç, tablo JSX'i kaldır |

---

## Task 1 — MatrisClient.tsx oluştur

**Files:**
- Create: `app/(dashboard)/odevler/sinif/[classId]/MatrisClient.tsx`

Bu bileşen `students`, `homeworks`, `subMap` prop'larını alır; `search` ve `sortBy` state'leri ile anlık filtreler/sıralar; tam tablo UI'ını render eder.

- [ ] **Step 1: Dosyayı oluştur**

`app/(dashboard)/odevler/sinif/[classId]/MatrisClient.tsx` içeriği:

```tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { format, parseISO } from '@/src/shared/date'

type SubmissionStatus = 'yapildi' | 'eksik' | 'yapilmadi' | 'gec' | 'mazeretli'

const STATUS_LABEL: Record<SubmissionStatus, string> = {
  yapildi: 'Yapıldı', eksik: 'Eksik', yapilmadi: 'Yapılmadı', gec: 'Geç', mazeretli: 'Mazeretli',
}

const CELL_CLS: Record<SubmissionStatus, string> = {
  yapildi:   'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400',
  eksik:     'bg-amber-100  text-amber-700  dark:bg-amber-900/40  dark:text-amber-400',
  yapilmadi: 'bg-red-100    text-red-700    dark:bg-red-900/40    dark:text-red-400',
  gec:       'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400',
  mazeretli: 'bg-slate-100  text-slate-600  dark:bg-slate-700     dark:text-slate-400',
}

const CELL_DOT: Record<SubmissionStatus, string> = {
  yapildi: '✓', eksik: '~', yapilmadi: '✗', gec: 'G', mazeretli: 'M',
}

function dueDateFmt(d: string | null) {
  if (!d) return '—'
  try { return format(parseISO(d), 'd MMM') } catch { return d }
}

function completionColor(pct: number) {
  if (pct >= 80) return 'text-emerald-600 dark:text-emerald-400'
  if (pct >= 50) return 'text-amber-600 dark:text-amber-400'
  return 'text-red-500 dark:text-red-400'
}

type Student  = { id: string; full_name: string; student_number: string | null }
type Homework = { id: string; title: string; subject: string; due_date: string | null }

type Props = {
  students:  Student[]
  homeworks: Homework[]
  subMap:    Record<string, SubmissionStatus>
}

export default function MatrisClient({ students, homeworks, subMap }: Props) {
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<'number' | 'pct_desc' | 'pct_asc'>('number')

  function studentStats(studentId: string) {
    let done = 0, eligible = 0
    for (const hw of homeworks) {
      const s = subMap[`${studentId}_${hw.id}`]
      if (!s || s === 'mazeretli') continue
      eligible++
      if (s === 'yapildi') done++
    }
    return { done, eligible, pct: eligible === 0 ? null : Math.round(done / eligible * 100) }
  }

  function homeworkStats(hwId: string) {
    let done = 0, eligible = 0
    for (const st of students) {
      const s = subMap[`${st.id}_${hwId}`]
      if (!s || s === 'mazeretli') continue
      eligible++
      if (s === 'yapildi') done++
    }
    return { done, eligible, pct: eligible === 0 ? null : Math.round(done / eligible * 100) }
  }

  const q = search.trim().toLowerCase()

  const filteredStudents = q
    ? students.filter(s =>
        s.full_name.toLowerCase().includes(q) ||
        (s.student_number ?? '').toLowerCase().includes(q)
      )
    : students

  const sortedStudents = [...filteredStudents].sort((a, b) => {
    if (sortBy === 'number') {
      return (a.student_number ?? '').localeCompare(b.student_number ?? '', undefined, { numeric: true })
    }
    const ap = studentStats(a.id).pct
    const bp = studentStats(b.id).pct
    if (ap === null && bp === null) return 0
    if (ap === null) return 1
    if (bp === null) return -1
    return sortBy === 'pct_desc' ? bp - ap : ap - bp
  })

  const showControls = students.length > 6

  return (
    <>
      {/* Filtre kontrolleri */}
      {showControls && (
        <div className="flex flex-wrap items-center gap-3 mb-4 print:hidden">
          <div className="relative flex-1 min-w-[180px]">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
            </svg>
            <input
              type="text"
              placeholder="Öğrenci ara..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm text-gray-700 dark:text-slate-300 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/10 placeholder:text-gray-400 transition-all"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as typeof sortBy)}
            className="py-2 px-3 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm text-gray-700 dark:text-slate-300 focus:outline-none focus:border-blue-400 transition-all"
          >
            <option value="number">Numara sırası</option>
            <option value="pct_desc">Tamamlanma ↓ (en başarılı)</option>
            <option value="pct_asc">Tamamlanma ↑ (en riskli)</option>
          </select>
        </div>
      )}

      {/* Filtre sonuç sayısı */}
      {q && (
        <p className="text-xs text-gray-400 mb-3 print:hidden">
          {sortedStudents.length === 0
            ? 'Sonuç bulunamadı.'
            : `${sortedStudents.length} / ${students.length} öğrenci gösteriliyor`}
        </p>
      )}

      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="text-xs border-collapse min-w-full">
            <thead>
              <tr className="bg-gray-50 dark:bg-slate-900/50">
                <th className="sticky left-0 z-10 bg-gray-50 dark:bg-slate-900/50 border-b border-r border-gray-200 dark:border-slate-700 px-3 py-3 text-left font-semibold text-gray-600 dark:text-slate-400 min-w-[180px]">
                  Öğrenci
                </th>
                {homeworks.map(hw => (
                  <th key={hw.id} className="border-b border-r border-gray-200 dark:border-slate-700 px-2 py-2 text-center font-medium text-gray-500 dark:text-slate-500 min-w-[52px] max-w-[64px]">
                    <Link
                      href={`/odevler/${hw.id}`}
                      className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                      title={hw.title}
                    >
                      <div className="text-[10px] font-bold text-gray-700 dark:text-slate-300 leading-tight truncate max-w-[56px]">
                        {hw.subject ?? '—'}
                      </div>
                      <div className="text-[10px] text-gray-400 dark:text-slate-500 mt-0.5">
                        {dueDateFmt(hw.due_date)}
                      </div>
                    </Link>
                  </th>
                ))}
                <th className="border-b border-gray-200 dark:border-slate-700 px-3 py-3 text-center font-semibold text-gray-600 dark:text-slate-400 min-w-[60px]">
                  Oran
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedStudents.map((student, si) => {
                const { done, eligible, pct } = studentStats(student.id)
                return (
                  <tr key={student.id} className={si % 2 === 0 ? '' : 'bg-gray-50/40 dark:bg-slate-900/20'}>
                    <td className={`sticky left-0 z-10 border-r border-b border-gray-200 dark:border-slate-700 px-3 py-2 font-medium text-gray-800 dark:text-slate-200 ${si % 2 === 0 ? 'bg-white dark:bg-slate-800' : 'bg-gray-50/70 dark:bg-slate-800/80'}`}>
                      <div className="flex items-center gap-2 min-w-0">
                        {student.student_number && (
                          <span className="text-[10px] text-gray-400 dark:text-slate-500 shrink-0 w-6 text-right">{student.student_number}</span>
                        )}
                        <span className="truncate max-w-[130px]">{student.full_name}</span>
                      </div>
                    </td>
                    {homeworks.map(hw => {
                      const status = subMap[`${student.id}_${hw.id}`]
                      return (
                        <td key={hw.id} className="border-r border-b border-gray-100 dark:border-slate-700/60 p-1 text-center">
                          {status ? (
                            <span
                              title={STATUS_LABEL[status]}
                              className={`inline-flex items-center justify-center w-7 h-7 rounded-lg text-[11px] font-bold ${CELL_CLS[status]}`}
                            >
                              {CELL_DOT[status]}
                            </span>
                          ) : (
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-gray-50 dark:bg-slate-700/40 text-gray-300 dark:text-slate-600 text-[10px]">·</span>
                          )}
                        </td>
                      )
                    })}
                    <td className="border-b border-gray-200 dark:border-slate-700 px-2 py-2 text-center">
                      {pct === null ? (
                        <span className="text-gray-300 dark:text-slate-600">—</span>
                      ) : (
                        <span className={`font-bold ${completionColor(pct)}`}>%{pct}</span>
                      )}
                      {eligible > 0 && (
                        <div className="text-[10px] text-gray-400 dark:text-slate-500">{done}/{eligible}</div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 dark:bg-slate-900/50 border-t-2 border-gray-300 dark:border-slate-600">
                <td className="sticky left-0 z-10 bg-gray-50 dark:bg-slate-900/50 border-r border-gray-200 dark:border-slate-700 px-3 py-2 font-semibold text-gray-600 dark:text-slate-400 text-[11px]">
                  Sınıf ortalaması
                </td>
                {homeworks.map(hw => {
                  const { pct } = homeworkStats(hw.id)
                  return (
                    <td key={hw.id} className="border-r border-gray-200 dark:border-slate-700 px-2 py-2 text-center">
                      {pct === null ? (
                        <span className="text-gray-300 dark:text-slate-600 text-[10px]">—</span>
                      ) : (
                        <span className={`font-bold text-[11px] ${completionColor(pct)}`}>%{pct}</span>
                      )}
                    </td>
                  )
                })}
                <td className="px-2 py-2" />
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="flex flex-wrap gap-3 px-4 py-3 border-t border-gray-100 dark:border-slate-700 print:hidden">
          {(Object.entries(CELL_DOT) as [SubmissionStatus, string][]).map(([s, dot]) => (
            <span key={s} className="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-slate-400">
              <span className={`inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-bold ${CELL_CLS[s]}`}>{dot}</span>
              {STATUS_LABEL[s]}
            </span>
          ))}
          <span className="flex items-center gap-1.5 text-[11px] text-gray-400 dark:text-slate-500">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-gray-50 dark:bg-slate-700/40 text-gray-300 dark:text-slate-600">·</span>
            Girilmedi
          </span>
        </div>
      </div>
    </>
  )
}
```

- [ ] **Step 2: TypeScript kontrolü**

```
npx tsc --noEmit
```

Beklenti: hata yok (yeni dosyada tip hatası yoksa).

- [ ] **Step 3: Commit**

```bash
git add "app/(dashboard)/odevler/sinif/[classId]/MatrisClient.tsx"
git commit -m "feat(matris): MatrisClient bileşeni — arama ve tamamlanma sıralaması"
```

---

## Task 2 — page.tsx'i MatrisClient kullanacak şekilde güncelle

**Files:**
- Modify: `app/(dashboard)/odevler/sinif/[classId]/page.tsx`

`page.tsx`'ten tablo JSX'i, `studentStats`, `homeworkStats`, `CELL_CLS`, `CELL_DOT`, `STATUS_LABEL`, `completionColor`, `dueDateFmt` kaldırılır. `subMap` `Record<string, SubmissionStatus>` olarak build edilip `MatrisClient`'a geçilir.

- [ ] **Step 1: page.tsx'i yeniden yaz**

Mevcut dosyanın tamamını şununla değiştir:

```tsx
import { createClient } from '@/src/infrastructure/supabase/server'
import { getCurrentProfile } from '@/src/shared/auth'
import { notFound, redirect } from 'next/navigation'
import { isTeachingRole, isMudurOrAbove } from '@/src/shared/types'
import Link from 'next/link'
import PrintButton from '@/components/PrintButton'
import MatrisClient from './MatrisClient'

type SubmissionStatus = 'yapildi' | 'eksik' | 'yapilmadi' | 'gec' | 'mazeretli'

export default async function SinifMatrisPage({
  params,
}: {
  params: Promise<{ classId: string }>
}) {
  const { classId } = await params
  const profile = await getCurrentProfile()
  if (!profile?.school_id) redirect('/login')

  const canSee = isTeachingRole(profile.role) || isMudurOrAbove(profile.role)
  if (!canSee) redirect('/odevler')

  const supabase = await createClient()
  const sid = profile.school_id

  const [clsRes, studentsRes, homeworksRes] = await Promise.all([
    supabase.from('classes').select('name, grade').eq('id', classId).eq('school_id', sid).single(),
    supabase
      .from('students')
      .select('id, full_name, student_number')
      .eq('class_id', classId)
      .eq('school_id', sid)
      .is('deleted_at', null)
      .order('student_number'),
    supabase
      .from('homeworks')
      .select('id, title, subject, due_date')
      .eq('class_id', classId)
      .eq('school_id', sid)
      .is('deleted_at', null)
      .eq('is_template', false)
      .order('due_date', { ascending: false })
      .limit(30),
  ])

  if (!clsRes.data) notFound()

  const students  = studentsRes.data  ?? []
  const homeworks = homeworksRes.data ?? []

  const hwIds = homeworks.map(h => h.id)
  const { data: rawSubs } = hwIds.length > 0
    ? await supabase
        .from('homework_submissions')
        .select('homework_id, student_id, status')
        .in('homework_id', hwIds)
        .eq('school_id', sid)
    : { data: [] as { homework_id: string; student_id: string; status: string }[] }

  const subMap: Record<string, SubmissionStatus> = {}
  for (const s of rawSubs ?? []) {
    subMap[`${s.student_id}_${s.homework_id}`] = s.status as SubmissionStatus
  }

  const cls = clsRes.data

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-50 via-indigo-50/10 to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="p-4 md:p-6">

        <div className="flex items-center justify-between mb-6 print:hidden">
          <div className="flex items-center gap-3">
            <Link
              href="/odevler"
              className="flex items-center justify-center w-9 h-9 rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-500 hover:text-gray-800 shadow-sm transition-all"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div>
              <h1 className="text-lg font-bold text-gray-900 dark:text-slate-100">
                {cls.name} — Ödev Matrisi
              </h1>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                {students.length} öğrenci · Son {homeworks.length} ödev
              </p>
            </div>
          </div>
          <PrintButton />
        </div>

        {homeworks.length === 0 || students.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <p className="text-gray-500 dark:text-slate-400 font-medium">
              {homeworks.length === 0 ? 'Bu sınıfa henüz ödev atanmamış.' : 'Bu sınıfta henüz öğrenci yok.'}
            </p>
            <Link href="/odevler" className="mt-4 text-sm text-blue-600 hover:underline">← Ödevlere dön</Link>
          </div>
        ) : (
          <MatrisClient
            students={students}
            homeworks={homeworks}
            subMap={subMap}
          />
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: TypeScript + testleri çalıştır**

```
npx tsc --noEmit
npm run test
```

Beklenti: tip hatası yok, 333 test geçiyor.

- [ ] **Step 3: Manuel doğrulama**

Dev server'ı başlat: `npm run dev`

Test senaryoları:
1. Sınıf matrisi sayfasına git (`/odevler/sinif/[classId]`)
2. **Arama:** Bir öğrencinin adının ilk 3 harfini yaz → sadece o öğrenci görünmeli, "X / Y öğrenci gösteriliyor" yazısı çıkmalı
3. **Temizle:** × butonuna tıkla → tüm öğrenciler geri gelmeli
4. **Sıralama:** "Tamamlanma ↓" seç → en yüksek % olan öğrenci üste gelmeli
5. **Sıralama:** "Tamamlanma ↑" seç → en düşük % (riskli) üste gelmeli
6. **Footer:** Sıralama değişince "Sınıf ortalaması" satırı değişmemeli
7. **Print:** `print:hidden` sınıfları — kontroller yazdırmada görünmemeli

- [ ] **Step 4: Commit ve push**

```bash
git add "app/(dashboard)/odevler/sinif/[classId]/page.tsx"
git commit -m "feat(matris): page.tsx MatrisClient kullanacak şekilde güncellendi"
git push origin main
```
