# Öğrenci Haftalık Yük Göstergesi Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Öğrenci ödev detay sayfasında (StatusBoard, profil modal) ve ödev oluşturma formunda o öğrencinin/sınıfın bu haftaki toplam ödev yükünü göster.

**Architecture:** `getClassWeekLoad` server action zaten var; `page.tsx`'te tek fetch yapılır, sonuç `StatusBoard` ve `StudentHomeworkProfileModal`'a prop olarak iletilir. `WeekLoadBanner`'a `isCreating` prop eklenerek öngörülü metin gösterilir.

**Tech Stack:** Next.js App Router, React, Tailwind v4, `ClassWeekLoad` tip (zaten mevcut)

---

## Dosya Haritası

| Dosya | İşlem |
|-------|-------|
| `app/(dashboard)/odevler/[id]/page.tsx` | `getClassWeekLoad` çağrısı + prop iletimi |
| `app/(dashboard)/odevler/[id]/StatusBoard.tsx` | `weekLoad` prop + `WeekLoadBadge` + `WeekLoadPopover` |
| `app/(dashboard)/odevler/[id]/StudentHomeworkProfileModal.tsx` | `weekLoad` prop + "Bu Hafta" satırı |
| `app/(dashboard)/odevler/yeni/HomeworkForm.tsx` | `WeekLoadBanner`'a `isCreating` prop |

---

## Task 1: page.tsx — getClassWeekLoad fetch + prop iletimi

**Files:**
- Modify: `app/(dashboard)/odevler/[id]/page.tsx`

- [ ] **Step 1: Import ekle**

`page.tsx`'in import bloğuna ekle:

```typescript
import { getClassWeekLoad } from '@/app/actions/homework'
import type { ClassWeekLoad } from '@/src/domains/homework/lib/week-load'
```

- [ ] **Step 2: `hw` fetch'inden sonra weekLoad çağrısı ekle**

`if (!hw || hw.is_template) notFound()` satırından sonra, diğer sorgulardan önce:

```typescript
const weekLoadResult = hw.due_date
  ? await getClassWeekLoad([hw.class_id as string], hw.due_date)
  : []
const weekLoad: ClassWeekLoad | null = weekLoadResult[0] ?? null
```

- [ ] **Step 3: StatusBoard'a weekLoad prop geçir**

```tsx
// ESKİ
<StatusBoard
  homeworkId={id}
  items={items}
  homeworkTitle={hw.title}
  totalHomeworks={totalHomeworkCount}
  classId={hw.class_id}
  dueDate={hw.due_date ? format(parseISO(hw.due_date), 'd MMMM yyyy') : ''}
  className={cls?.name ?? ''}
/>

// YENİ
<StatusBoard
  homeworkId={id}
  items={items}
  homeworkTitle={hw.title}
  totalHomeworks={totalHomeworkCount}
  classId={hw.class_id}
  dueDate={hw.due_date ? format(parseISO(hw.due_date), 'd MMMM yyyy') : ''}
  className={cls?.name ?? ''}
  weekLoad={weekLoad}
/>
```

- [ ] **Step 4: TypeScript kontrolü**

```bash
npx tsc --noEmit
```
Expected: sıfır hata

- [ ] **Step 5: Commit**

```bash
git add app/(dashboard)/odevler/[id]/page.tsx
git commit -m "feat(homework): öğrenci haftalık yük — page.tsx fetch + prop"
```

---

## Task 2: StatusBoard.tsx — WeekLoadBadge + WeekLoadPopover

**Files:**
- Modify: `app/(dashboard)/odevler/[id]/StatusBoard.tsx`

- [ ] **Step 1: Import ekle**

`'use client'` sonrası import bloğuna:

```typescript
import type { ClassWeekLoad } from '@/src/domains/homework/lib/week-load'
```

- [ ] **Step 2: Prop tipine `weekLoad` ekle**

```typescript
// ESKİ
export default function StatusBoard({
  homeworkId, items, homeworkTitle, totalHomeworks, classId, dueDate = '', className = '',
}: {
  homeworkId: string
  items: StatusItem[]
  homeworkTitle?: string
  totalHomeworks: number
  classId: string
  dueDate?: string
  className?: string
})

// YENİ
export default function StatusBoard({
  homeworkId, items, homeworkTitle, totalHomeworks, classId, dueDate = '', className = '', weekLoad = null,
}: {
  homeworkId: string
  items: StatusItem[]
  homeworkTitle?: string
  totalHomeworks: number
  classId: string
  dueDate?: string
  className?: string
  weekLoad?: ClassWeekLoad | null
})
```

- [ ] **Step 3: `openBadge` state ekle**

Mevcut `useState` bloklarının altına:

```typescript
const [openBadge, setOpenBadge] = useState<boolean>(false)
```

- [ ] **Step 4: Öğrenci satırında rozet ekle**

Öğrenci satırındaki isim düğmesinin (`<button onClick={() => setSelectedStudentId...}`) hemen yanına, `student_number` span'ından önce rozeti yerleştir.

`<div className="flex items-center gap-2 mt-0.5">` bloğunun başına (mevcut `student_number` span'ından önce) ekle:

```tsx
{weekLoad && weekLoad.count > 0 && (
  <WeekLoadBadge load={weekLoad} open={openBadge} onToggle={() => setOpenBadge(p => !p)} />
)}
```

- [ ] **Step 5: Backdrop overlay ekle**

`return (` içindeki `<div>` üst kapsayıcısının hemen içine, ilk child olarak:

```tsx
{openBadge && (
  <div
    className="fixed inset-0 z-10"
    onClick={() => setOpenBadge(false)}
  />
)}
```

- [ ] **Step 6: `WeekLoadBadge` ve `WeekLoadPopover` inline bileşenlerini dosya sonuna ekle**

Dosyanın en sonuna (son `}` kapanışından önce değil, sonra) ekle:

```tsx
function WeekLoadBadge({
  load,
  open,
  onToggle,
}: {
  load: ClassWeekLoad
  open: boolean
  onToggle: () => void
}) {
  const badgeCls =
    load.level === 'danger'
      ? 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400 border-red-200 dark:border-red-800'
      : load.level === 'warn'
        ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400 border-amber-200 dark:border-amber-800'
        : 'bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-slate-400 border-gray-200 dark:border-slate-600'

  return (
    <div className="relative z-20">
      <button
        type="button"
        onClick={e => { e.stopPropagation(); onToggle() }}
        className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-full border transition-colors ${badgeCls}`}
      >
        ● {load.count}
      </button>
      {open && <WeekLoadPopover load={load} />}
    </div>
  )
}

function WeekLoadPopover({ load }: { load: ClassWeekLoad }) {
  const DAY_LABELS: Record<string, string> = {
    '1': 'Pzt', '2': 'Sal', '3': 'Çar', '4': 'Per', '5': 'Cum', '6': 'Cmt', '0': 'Paz',
  }

  function dayLabel(dateStr: string) {
    try {
      const d = new Date(dateStr)
      return `${d.getDate()} ${['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'][d.getMonth()]} (${DAY_LABELS[String(d.getDay())]})`
    } catch { return dateStr }
  }

  return (
    <div className="absolute left-0 top-7 z-30 w-64 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-lg p-3 space-y-2">
      <p className={`text-xs font-semibold ${
        load.level === 'danger' ? 'text-red-600 dark:text-red-400' :
        load.level === 'warn'   ? 'text-amber-600 dark:text-amber-400' :
                                   'text-gray-600 dark:text-slate-400'
      }`}>
        Bu hafta {load.count} ödev
      </p>
      <div className="space-y-1.5">
        {load.items.map((item, i) => (
          <div key={i} className="flex items-start gap-2">
            <span className={`shrink-0 mt-0.5 text-[10px] font-bold ${item.isOwn ? 'text-blue-500' : 'text-gray-400 dark:text-slate-500'}`}>
              {item.isOwn ? '★' : '·'}
            </span>
            <div className="min-w-0">
              <p className="text-xs text-gray-800 dark:text-slate-200 leading-snug truncate">{item.subject}</p>
              <p className="text-[11px] text-gray-400 dark:text-slate-500">
                {dayLabel(item.dueDate)}
                {!item.isOwn && ` · ${item.teacherName}`}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 7: StudentHomeworkProfileModal'a weekLoad prop geçir**

StatusBoard içindeki `<StudentHomeworkProfileModal` çağrısını güncelle:

```tsx
// ESKİ
<StudentHomeworkProfileModal
  studentId={selectedStudentId}
  classId={classId}
  onClose={() => setSelectedStudentId(null)}
/>

// YENİ
<StudentHomeworkProfileModal
  studentId={selectedStudentId}
  classId={classId}
  weekLoad={weekLoad}
  onClose={() => setSelectedStudentId(null)}
/>
```

- [ ] **Step 8: TypeScript kontrolü**

```bash
npx tsc --noEmit
```
Expected: sıfır hata

- [ ] **Step 9: Commit**

```bash
git add app/(dashboard)/odevler/[id]/StatusBoard.tsx
git commit -m "feat(homework): StatusBoard'a haftalık yük rozeti + popover eklendi"
```

---

## Task 3: StudentHomeworkProfileModal.tsx — "Bu Hafta" özet satırı

**Files:**
- Modify: `app/(dashboard)/odevler/[id]/StudentHomeworkProfileModal.tsx`

- [ ] **Step 1: Import ekle**

```typescript
import type { ClassWeekLoad } from '@/src/domains/homework/lib/week-load'
```

- [ ] **Step 2: `weekLoad` prop ekle**

```typescript
// ESKİ
export default function StudentHomeworkProfileModal({
  studentId, classId, onClose,
}: {
  studentId: string | null
  classId: string
  onClose: () => void
})

// YENİ
export default function StudentHomeworkProfileModal({
  studentId, classId, weekLoad = null, onClose,
}: {
  studentId: string | null
  classId: string
  weekLoad?: ClassWeekLoad | null
  onClose: () => void
})
```

- [ ] **Step 3: "Bu Hafta" satırını profile adının altına ekle**

Modal başlık bölümünde (`profile.student.full_name` span'ından hemen sonra, veli bilgisi `div`'inden önce):

```tsx
{/* Mevcut veli satırından ÖNCE ekle */}
{weekLoad && weekLoad.count > 0 && (
  <div className="flex items-center gap-1.5 mt-1">
    <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-full border ${
      weekLoad.level === 'danger'
        ? 'bg-red-100 text-red-600 border-red-200 dark:bg-red-900/40 dark:text-red-400 dark:border-red-800'
        : weekLoad.level === 'warn'
          ? 'bg-amber-100 text-amber-600 border-amber-200 dark:bg-amber-900/40 dark:text-amber-400 dark:border-amber-800'
          : 'bg-gray-100 text-gray-500 border-gray-200 dark:bg-slate-700 dark:text-slate-400 dark:border-slate-600'
    }`}>
      ● {weekLoad.count}
    </span>
    <span className="text-xs text-gray-400 dark:text-slate-500">bu hafta ödev</span>
  </div>
)}
```

- [ ] **Step 4: TypeScript kontrolü + testler**

```bash
npx tsc --noEmit
npx vitest run --reporter=verbose 2>&1 | Select-Object -Last 8
```
Expected: sıfır TS hatası, tüm testler geçer

- [ ] **Step 5: Commit**

```bash
git add app/(dashboard)/odevler/[id]/StudentHomeworkProfileModal.tsx
git commit -m "feat(homework): öğrenci profil modalına haftalık yük özeti eklendi"
```

---

## Task 4: HomeworkForm.tsx — WeekLoadBanner öngörülü metin

**Files:**
- Modify: `app/(dashboard)/odevler/yeni/HomeworkForm.tsx`

- [ ] **Step 1: WeekLoadBanner'a isCreating prop ekle ve çağrısı güncelle**

`HomeworkForm`'daki `<WeekLoadBanner>` çağrısını güncelle:

```tsx
// ESKİ
{!isTemplate && (
  <WeekLoadBanner loads={weekLoad} loading={loadingLoad} />
)}

// YENİ
{!isTemplate && (
  <WeekLoadBanner loads={weekLoad} loading={loadingLoad} isCreating />
)}
```

- [ ] **Step 2: WeekLoadBanner fonksiyonunu güncelle**

```typescript
// ESKİ imza
function WeekLoadBanner({ loads, loading }: { loads: ClassWeekLoad[]; loading: boolean })

// YENİ imza
function WeekLoadBanner({ loads, loading, isCreating = false }: { loads: ClassWeekLoad[]; loading: boolean; isCreating?: boolean })
```

`worstLevel` hesabının hemen altına, mevcut `if (loads.length === 0 ...)` kontrolünden önce:

```typescript
// isCreating=true → gösterilen count değerlerini 1 artır
const displayLoads = isCreating
  ? loads.map(l => ({
      ...l,
      count: l.count + 1,
      level: (l.count + 1 >= 5 ? 'danger' : l.count + 1 >= 3 ? 'warn' : 'ok') as 'ok' | 'warn' | 'danger',
    }))
  : loads

const worstDisplayLevel = displayLoads.reduce<'ok' | 'warn' | 'danger'>((acc, l) => {
  if (l.level === 'danger') return 'danger'
  if (l.level === 'warn' && acc !== 'danger') return 'warn'
  return acc
}, 'ok')
```

Sonra `worstLevel` yerine `worstDisplayLevel` kullan (bg, titleColor, icon hesabında).

Metin satırını güncelle:

```tsx
// ESKİ
Bu hafta{loads.length > 1 ? ' (seçili sınıflar)' : ''}:

// YENİ
{isCreating
  ? `Bu ödev dahil${displayLoads.length > 1 ? ' (seçili sınıflar)' : ''}:`
  : `Bu hafta${displayLoads.length > 1 ? ' (seçili sınıflar)' : ''}:`
}
```

Count gösterimi güncelle (`{l.count} ödev` → `{displayLoads.find(d => d.classId === l.classId)?.count ?? l.count} ödev`):

Altta `loads.filter(l => l.count > 0).map(l => ...)` satırını `displayLoads.filter(l => l.count > 0).map(l => ...)` olarak değiştir ve içeride `l.count` kullan (artık displayLoads'dan geliyor).

- [ ] **Step 3: `if (loads.length === 0 ...)` kontrolünü displayLoads'a çevir**

```typescript
// ESKİ
if (loads.length === 0 || loads.every(l => l.count === 0)) return null

// YENİ
if (displayLoads.length === 0 || displayLoads.every(l => l.count === 0)) return null
```

- [ ] **Step 4: TypeScript kontrolü + tüm testler**

```bash
npx tsc --noEmit
npx vitest run 2>&1 | Select-Object -Last 6
```
Expected: sıfır hata, 404 test geçer

- [ ] **Step 5: Commit + push**

```bash
git add app/(dashboard)/odevler/yeni/HomeworkForm.tsx
git commit -m "feat(homework): WeekLoadBanner öngörülü metin (bu ödev dahil X olacak)"
git push origin main
```
