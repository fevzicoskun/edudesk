# Ödev Sistemi Kapsamlı İyileştirme — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Öğretmenin "bunu kullanmak zorundayım" dediği bir ödev sistemi — hızlı giriş, günlük cockpit, tek tıkla veli iletişimi.

**Architecture:** 3 bağımsız paket: (1) Hızlı Ödev Drawer — FAB + slide-in drawer + şablon desteği, (2) OdevCockpit — anasayfada gecikmiş ödev uyarısı, (3) Veli İletişim Merkezi — StatusBoard içinde WhatsApp + Resend mail paneli + Inngest otomatik bildirim.

**Tech Stack:** Next.js App Router, React 19, Tailwind v4, Supabase SSR, Inngest, Resend (mailer), TypeScript, Vitest.

---

## Dosya Haritası

### Yeni dosyalar
- `components/homework/QuickAddDrawer.tsx` — FAB + drawer client component
- `app/(dashboard)/anasayfa/OdevCockpit.tsx` — gecikmiş ödev uyarısı server component
- `app/(dashboard)/odevler/[id]/VeliIletisimPaneli.tsx` — WhatsApp + mail paneli client component
- `app/actions/veli-bildirim.ts` — `sendHomeworkReminderEmails` server action
- `src/domains/notifications/functions/homeworkCreatedNotifier.ts` — Inngest function

### Değişen dosyalar
- `src/domains/homework/repositories/HomeworkRepository.ts` — `findTemplatesByClass` eklenir
- `src/domains/homework/services/HomeworkService.ts` — `getTemplatesByClass` eklenir
- `src/domains/homework/types/index.ts` — `HomeworkTemplate` tipi export edilir
- `app/actions/homework.ts` — `quickCreateHomework` + `getHomeworkTemplates` eklenir
- `app/actions/classes.ts` — `getMyClasses` eklenir
- `app/(dashboard)/layout.tsx` — `QuickAddDrawer` eklenir
- `app/(dashboard)/anasayfa/OgretmenDashboard.tsx` — `OdevCockpit` eklenir
- `app/(dashboard)/odevler/[id]/page.tsx` — `veli_email` query'ye eklenir, `VeliWhatsApp` kaldırılır, `VeliIletisimPaneli` eklenir, `StatusBoard` props güncellenir
- `app/(dashboard)/odevler/[id]/StatusBoard.tsx` — `StatusItem` tipi genişletilir, `dueDate`/`className` props eklenir, `VeliIletisimPaneli` render edilir
- `app/api/inngest/route.ts` — `homeworkCreatedNotifierFn` register edilir

### Silinen dosyalar
- `app/(dashboard)/odevler/[id]/VeliWhatsApp.tsx`

---

## Task 1: getTemplatesByClass — Repository → Service → Action → Test

**Files:**
- Modify: `src/domains/homework/repositories/HomeworkRepository.ts`
- Modify: `src/domains/homework/services/HomeworkService.ts`
- Modify: `src/domains/homework/types/index.ts` (re-export yeterli — tip shared/types'a eklenir)
- Modify: `app/actions/homework.ts`
- Modify: `tests/vitest/unit/homework/homework-service.test.ts`

- [ ] **Step 1: Tip tanımla — `src/shared/types/index.ts` içine `HomeworkTemplate` ekle**

Dosyayı aç ve mevcut `Homework` interface'inin altına ekle:

```ts
export interface HomeworkTemplate {
  id: string
  title: string
  subject: string
  description: string | null
  source_id: string | null
}
```

- [ ] **Step 2: Repository metodunu yaz**

`src/domains/homework/repositories/HomeworkRepository.ts` dosyasını aç. `restoreHomework` metodunun hemen ardına ekle:

```ts
  async findTemplatesByClass(classId: string, teacherId: string, schoolId: string) {
    const supabase = await createClient()
    return supabase
      .from('homeworks')
      .select('id, title, subject, description, source_id')
      .eq('class_id', classId)
      .eq('teacher_id', teacherId)
      .eq('school_id', schoolId)
      .eq('is_template', true)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(10)
  },
```

- [ ] **Step 3: Failing unit test yaz**

`tests/vitest/unit/homework/homework-service.test.ts` dosyasını aç.

Mock listesine `findTemplatesByClass: vi.fn()` ekle:

```ts
vi.mock('@/src/domains/homework/repositories/HomeworkRepository', () => ({
  HomeworkRepository: {
    // ... mevcut mock'lar ...
    findTemplatesByClass: vi.fn(),
  },
}))
```

`getStudentHomeworkProfile` describe bloğunun ÖNÜNE şunu ekle:

```ts
// ─────────────────────────────────────────────────────────────
describe('HomeworkService.getTemplatesByClass()', () => {
  it('giriş yoksa boş dizi döner', async () => {
    vi.mocked(getAbility).mockResolvedValue(null)
    const result = await HomeworkService.getTemplatesByClass('cls-1')
    expect(result).toEqual([])
    expect(HomeworkRepository.findTemplatesByClass).not.toHaveBeenCalled()
  })

  it('read izni yoksa boş dizi döner', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility([]) as never)
    const result = await HomeworkService.getTemplatesByClass('cls-1')
    expect(result).toEqual([])
  })

  it('şablonları döndürür', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility() as never)
    vi.mocked(HomeworkRepository.findTemplatesByClass).mockResolvedValue({
      data: [{ id: 't1', title: 'Şablon A', subject: 'Mat', description: null, source_id: null }],
      error: null,
    } as never)
    const result = await HomeworkService.getTemplatesByClass('cls-1')
    expect(result).toHaveLength(1)
    expect(result[0].title).toBe('Şablon A')
    expect(HomeworkRepository.findTemplatesByClass).toHaveBeenCalledWith('cls-1', TEACHER_ID, SCHOOL_ID)
  })

  it('DB hatası varsa boş dizi döner', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility() as never)
    vi.mocked(HomeworkRepository.findTemplatesByClass).mockResolvedValue({
      data: null, error: { message: 'DB hatası' },
    } as never)
    const result = await HomeworkService.getTemplatesByClass('cls-1')
    expect(result).toEqual([])
  })
})
```

- [ ] **Step 4: Testi çalıştır — FAIL bekliyoruz**

```bash
npx vitest run tests/vitest/unit/homework/homework-service.test.ts
```

Beklenen: `HomeworkService.getTemplatesByClass is not a function` hatası.

- [ ] **Step 5: Service metodunu yaz**

`src/domains/homework/services/HomeworkService.ts` dosyasında `import type { SubmissionStatus }` satırının yanına `HomeworkTemplate` ekle:

```ts
import type { SubmissionStatus, HomeworkTemplate } from '@/src/shared/types'
```

`restoreHomework` metodunun ardına ekle:

```ts
  async getTemplatesByClass(classId: string): Promise<HomeworkTemplate[]> {
    const ability = await getAbility()
    if (!ability || ability.cannot(P.HOMEWORK.READ)) return []
    const { data } = await HomeworkRepository.findTemplatesByClass(classId, ability.userId, ability.schoolId)
    return data ?? []
  },
```

- [ ] **Step 6: Testi çalıştır — PASS bekliyoruz**

```bash
npx vitest run tests/vitest/unit/homework/homework-service.test.ts
```

Beklenen: Tüm testler PASS.

- [ ] **Step 7: action'a ekle**

`app/actions/homework.ts` dosyasını aç. En sona ekle:

```ts
export async function getHomeworkTemplates(classId: string): Promise<HomeworkTemplate[]> {
  UUID.parse(classId)
  return HomeworkService.getTemplatesByClass(classId)
}
```

Dosyanın başındaki import'a `HomeworkTemplate` ekle:
```ts
import type { SubmissionStatus, HomeworkTemplate } from '@/src/shared/types'
```

- [ ] **Step 8: Tüm unit testler hâlâ yeşil mi kontrol et**

```bash
npm run test:unit
```

Beklenen: Tüm testler PASS.

- [ ] **Step 9: Commit**

```bash
git add src/domains/homework/repositories/HomeworkRepository.ts src/domains/homework/services/HomeworkService.ts app/actions/homework.ts tests/vitest/unit/homework/homework-service.test.ts src/shared/types/index.ts
git commit -m "feat(homework): getTemplatesByClass servis + repo + action + testler"
```

---

## Task 2: getMyClasses + quickCreateHomework Actions

**Files:**
- Modify: `app/actions/classes.ts`
- Modify: `app/actions/homework.ts`

- [ ] **Step 1: getMyClasses action**

`app/actions/classes.ts` dosyasını aç. Import'lara ekle (varsa atla):

```ts
import { getAbility } from '@/src/shared/authorization/server'
import { createClient } from '@/src/infrastructure/supabase/server'
```

En sona ekle:

```ts
export async function getMyClasses(): Promise<{ id: string; name: string; grade: number | null }[]> {
  const ability = await getAbility()
  if (!ability) return []
  const supabase = await createClient()
  const { data } = await supabase
    .from('classes')
    .select('id, name, grade')
    .eq('school_id', ability.schoolId)
    .is('deleted_at', null)
    .order('grade')
    .order('name')
  return data ?? []
}
```

- [ ] **Step 2: quickCreateHomework action yaz**

`app/actions/homework.ts` dosyasını aç. `createHomework` fonksiyonunun ALTINA, `updateSubmissionStatus` ÜSTÜNE ekle:

```ts
export async function quickCreateHomework(
  formData: FormData
): Promise<{ error?: string; ids?: string[] }> {
  const classIds = (formData.getAll('class_id') as string[]).filter(Boolean)
  if (classIds.length === 0) return { error: 'En az bir sınıf seçin' }
  for (const id of classIds) {
    if (!UUID.safeParse(id).success) return { error: 'Geçersiz sınıf seçimi' }
  }

  const parsed = createHomeworkSchema.omit({ class_id: true }).safeParse({
    title:       formData.get('title'),
    description: formData.get('description') || null,
    subject:     formData.get('subject'),
    due_date:    formData.get('due_date') || null,
    source_id:   null,
    is_template: false,
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Geçersiz veri' }
  if (!parsed.data.due_date) return { error: 'Son teslim tarihi gerekli' }

  const today = new Date().toISOString().split('T')[0]
  if (parsed.data.due_date < today) return { error: 'Son teslim tarihi bugün veya sonrası olmalı' }

  const results = await Promise.allSettled(
    classIds.map(classId =>
      HomeworkService.createHomework({
        class_id:    classId,
        title:       parsed.data.title,
        description: parsed.data.description ?? null,
        subject:     parsed.data.subject,
        due_date:    parsed.data.due_date!,
        source_id:   null,
        is_template: false,
      })
    )
  )

  const ids = results
    .filter((r): r is PromiseFulfilledResult<{ id?: string; error?: string }> =>
      r.status === 'fulfilled' && !r.value.error
    )
    .map(r => r.value.id!)
    .filter(Boolean)

  if (ids.length === 0) return { error: 'Ödev oluşturulamadı' }

  revalidatePath('/odevler')
  revalidatePath('/anasayfa')
  return { ids }
}
```

- [ ] **Step 3: TypeScript build kontrolü**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Beklenen: Hata yok.

- [ ] **Step 4: Commit**

```bash
git add app/actions/classes.ts app/actions/homework.ts
git commit -m "feat(homework): quickCreateHomework + getMyClasses action"
```

---

## Task 3: QuickAddDrawer Component

**Files:**
- Create: `components/homework/QuickAddDrawer.tsx`

- [ ] **Step 1: Dosyayı oluştur**

`components/homework/` klasörü yoksa oluştur. `QuickAddDrawer.tsx` dosyasını yaz:

```tsx
'use client'

import { useState, useEffect, useTransition } from 'react'
import { useToast } from '@/components/Toast'
import { quickCreateHomework, getHomeworkTemplates } from '@/app/actions/homework'
import { getMyClasses } from '@/app/actions/classes'
import type { HomeworkTemplate } from '@/src/shared/types'

type ClassItem = { id: string; name: string; grade: number | null }

const RECENT_KEY = 'hw_recent_class_ids'

function getRecentIds(): string[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') } catch { return [] }
}

function saveRecentIds(ids: string[]) {
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(ids.slice(0, 3))) } catch {}
}

const INPUT = 'w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-gray-900 dark:text-slate-100 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/10 transition-all'

export default function QuickAddDrawer() {
  const [open, setOpen]                       = useState(false)
  const [classes, setClasses]                 = useState<ClassItem[]>([])
  const [selectedIds, setSelectedIds]         = useState<string[]>([])
  const [templates, setTemplates]             = useState<HomeworkTemplate[]>([])
  const [title, setTitle]                     = useState('')
  const [subject, setSubject]                 = useState('')
  const [description, setDescription]         = useState('')
  const [dueDate, setDueDate]                 = useState('')
  const [notifyParents, setNotifyParents]     = useState(true)
  const [error, setError]                     = useState<string | null>(null)
  const [isPending, startTransition]          = useTransition()
  const { toast }                             = useToast()

  useEffect(() => {
    if (!open || classes.length > 0) return
    getMyClasses().then(setClasses)
  }, [open, classes.length])

  useEffect(() => {
    if (selectedIds.length !== 1) { setTemplates([]); return }
    getHomeworkTemplates(selectedIds[0]).then(setTemplates)
  }, [selectedIds])

  const recentIds = getRecentIds()
  const sortedClasses = [
    ...classes.filter(c => recentIds.includes(c.id)),
    ...classes.filter(c => !recentIds.includes(c.id)),
  ]

  function applyTemplate(t: HomeworkTemplate) {
    setTitle(t.title)
    setSubject(t.subject)
    setDescription(t.description ?? '')
  }

  function reset() {
    setSelectedIds([])
    setTitle('')
    setSubject('')
    setDescription('')
    setDueDate('')
    setError(null)
    setTemplates([])
  }

  function close() { setOpen(false); reset() }

  function submit() {
    if (selectedIds.length === 0) { setError('En az bir sınıf seçin'); return }
    if (!title.trim())            { setError('Başlık gerekli'); return }
    if (!subject.trim())          { setError('Ders adı gerekli'); return }
    if (!dueDate)                 { setError('Son teslim tarihi gerekli'); return }
    setError(null)

    startTransition(async () => {
      const fd = new FormData()
      selectedIds.forEach(id => fd.append('class_id', id))
      fd.set('title', title.trim())
      fd.set('subject', subject.trim())
      fd.set('description', description.trim())
      fd.set('due_date', dueDate)
      fd.set('notify_parents', notifyParents ? 'true' : 'false')

      const result = await quickCreateHomework(fd)
      if (result.error) { setError(result.error); return }

      saveRecentIds([...new Set([selectedIds[0], ...recentIds])])
      toast(`${result.ids!.length > 1 ? result.ids!.length + ' sınıfa' : ''} Ödev oluşturuldu`, 'success')
      close()
    })
  }

  const today = new Date().toISOString().split('T')[0]

  return (
    <>
      {/* FAB */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Hızlı ödev ekle"
        className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-40 w-14 h-14 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-full shadow-lg shadow-blue-500/30 flex items-center justify-center transition-all"
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40"
          onClick={close}
          aria-hidden="true"
        />
      )}

      {/* Drawer */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Hızlı ödev ekle"
        className={`fixed bottom-0 right-0 z-50 w-full md:w-[420px] h-[92dvh] md:h-full bg-white dark:bg-slate-900 shadow-2xl flex flex-col rounded-t-2xl md:rounded-none transition-transform duration-300 ease-in-out ${
          open ? 'translate-y-0 md:translate-x-0' : 'translate-y-full md:translate-x-full'
        }`}
      >
        {/* Başlık */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100 dark:border-slate-800 shrink-0">
          <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100">Hızlı Ödev Ekle</h2>
          <button
            onClick={close}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-400 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-800 rounded-xl px-3 py-2.5">
              {error}
            </p>
          )}

          {/* Sınıf */}
          <div>
            <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-2">
              Sınıf {selectedIds.length > 1 && <span className="font-normal normal-case text-blue-600">({selectedIds.length} seçili)</span>}
            </p>
            <div className="flex flex-wrap gap-2">
              {sortedClasses.length === 0 && (
                <p className="text-sm text-gray-400 dark:text-slate-500">Yükleniyor...</p>
              )}
              {sortedClasses.map(c => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() =>
                    setSelectedIds(prev =>
                      prev.includes(c.id) ? prev.filter(id => id !== c.id) : [...prev, c.id]
                    )
                  }
                  className={`px-3 py-1.5 rounded-xl border text-sm font-medium transition-colors ${
                    selectedIds.includes(c.id)
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 border-gray-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-600'
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>

          {/* Şablonlar */}
          {templates.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                Şablondan doldur
              </p>
              <div className="flex flex-col gap-1.5">
                {templates.map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => applyTemplate(t)}
                    className="text-left px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 hover:border-blue-300 dark:hover:border-blue-600 transition-colors"
                  >
                    <p className="text-sm font-medium text-gray-800 dark:text-slate-200">{t.title}</p>
                    <p className="text-xs text-gray-400 dark:text-slate-500">{t.subject}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Başlık */}
          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Başlık</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Örn: Sayfa 45–47 soruları"
              className={`mt-1.5 ${INPUT}`}
            />
          </div>

          {/* Ders */}
          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Ders</label>
            <input
              type="text"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="Örn: Matematik"
              className={`mt-1.5 ${INPUT}`}
            />
          </div>

          {/* Açıklama */}
          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
              Açıklama{' '}
              <span className="font-normal text-gray-400 dark:text-slate-500 normal-case tracking-normal">(opsiyonel)</span>
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              className={`mt-1.5 ${INPUT} resize-none`}
            />
          </div>

          {/* Tarih */}
          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Son teslim tarihi</label>
            <input
              type="date"
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
              min={today}
              className={`mt-1.5 ${INPUT}`}
            />
          </div>

          {/* Veli bildirimi */}
          <label className="flex items-center gap-3 cursor-pointer py-1">
            <input
              type="checkbox"
              checked={notifyParents}
              onChange={e => setNotifyParents(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-600 dark:text-slate-400">Oluşturulunca velilere e-posta gönder</span>
          </label>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-100 dark:border-slate-800 shrink-0">
          <button
            type="button"
            onClick={submit}
            disabled={isPending}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-3 text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isPending ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Kaydediliyor...
              </>
            ) : (
              'Ödevi Oluştur'
            )}
          </button>
        </div>
      </div>
    </>
  )
}
```

- [ ] **Step 2: TypeScript kontrolü**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Beklenen: Hata yok.

- [ ] **Step 3: Commit**

```bash
git add components/homework/QuickAddDrawer.tsx
git commit -m "feat(homework): QuickAddDrawer bileşeni (FAB + drawer + şablon)"
```

---

## Task 4: Layout — QuickAddDrawer Montajı

**Files:**
- Modify: `app/(dashboard)/layout.tsx`

- [ ] **Step 1: Layout'u düzenle**

`app/(dashboard)/layout.tsx` dosyasını aç. Şu anda server component. `isTeachingRole` kontrolü ekleyeceğiz.

Import'lara ekle:
```ts
import QuickAddDrawer from '@/components/homework/QuickAddDrawer'
import { isTeachingRole } from '@/src/shared/types'
```

`profile` zaten alınıyor. `main` tagından sonra ve `</ToastProvider>` öncesine ekle:

```tsx
    <ToastProvider>
      <div className="flex h-full bg-gray-50 dark:bg-slate-950">
        <Sidebar profile={profile} email={user.email ?? ''} />
        <main className="flex-1 overflow-auto pt-14 md:pt-0 pb-16 md:pb-0 mobile-main">{children}</main>
      </div>
      {isTeachingRole(profile?.role) && <QuickAddDrawer />}
    </ToastProvider>
```

- [ ] **Step 2: TypeScript kontrolü**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Dev sunucusunu çalıştır ve drawer'ı test et**

```bash
npm run dev
```

`http://localhost:3000/anasayfa` aç. Sağ altta mavi + butonu görünmeli. Tıklayınca drawer açılmalı.

- [ ] **Step 4: Commit**

```bash
git add app/(dashboard)/layout.tsx
git commit -m "feat(homework): QuickAddDrawer dashboard layout'a eklendi"
```

---

## Task 5: OdevCockpit + OgretmenDashboard Entegrasyonu

**Files:**
- Create: `app/(dashboard)/anasayfa/OdevCockpit.tsx`
- Modify: `app/(dashboard)/anasayfa/OgretmenDashboard.tsx`

- [ ] **Step 1: OdevCockpit server component yaz**

`app/(dashboard)/anasayfa/OdevCockpit.tsx` dosyasını oluştur:

```tsx
import Link from 'next/link'
import { createClient } from '@/src/infrastructure/supabase/server'
import { getCurrentUser } from '@/src/shared/auth'

export default async function OdevCockpit({ schoolId }: { schoolId: string }) {
  const user = await getCurrentUser()
  if (!user) return null

  const supabase = await createClient()
  const today = new Date().toISOString().split('T')[0]

  // Gecikmiş + hiç giriş yapılmamış ödevler
  const [overdueRes, pendingSubsRes] = await Promise.all([
    supabase
      .from('homeworks')
      .select('id, title, due_date, class_id, classes(name)')
      .eq('teacher_id', user.id)
      .eq('school_id', schoolId)
      .eq('is_template', false)
      .is('deleted_at', null)
      .lt('due_date', today)
      .order('due_date', { ascending: false })
      .limit(20),
    supabase
      .from('homework_submissions')
      .select('homework_id')
      .eq('school_id', schoolId),
  ])

  const allOverdue = overdueRes.data ?? []
  const submittedHwIds = new Set((pendingSubsRes.data ?? []).map(s => s.homework_id))
  const unreviewed = allOverdue.filter(hw => !submittedHwIds.has(hw.id))

  if (unreviewed.length === 0) return null

  return (
    <div className="mb-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-2xl overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-red-200 dark:border-red-800/60">
        <div className="w-7 h-7 bg-red-100 dark:bg-red-900/40 rounded-lg flex items-center justify-center shrink-0">
          <svg className="w-4 h-4 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-red-800 dark:text-red-300">
            {unreviewed.length} ödev giriş bekliyor
          </p>
          <p className="text-xs text-red-600/80 dark:text-red-400/70 mt-0.5">
            Son tarihi geçti, henüz hiç işaretleme yapılmadı.
          </p>
        </div>
      </div>
      <div className="divide-y divide-red-100 dark:divide-red-900/40">
        {unreviewed.slice(0, 5).map(hw => {
          const cls = hw.classes as { name: string } | null
          const daysAgo = Math.floor((new Date().getTime() - new Date(hw.due_date).getTime()) / 86_400_000)
          return (
            <Link
              key={hw.id}
              href={`/odevler/${hw.id}`}
              className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-red-100/50 dark:hover:bg-red-900/20 transition-colors group"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate group-hover:text-red-700 dark:group-hover:text-red-300 transition-colors">
                  {hw.title}
                </p>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                  {cls?.name ?? '—'}
                </p>
              </div>
              <span className="shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
                {daysAgo === 0 ? 'bugün bitti' : `${daysAgo}g önce`}
              </span>
            </Link>
          )
        })}
        {unreviewed.length > 5 && (
          <Link
            href="/odevler"
            className="block px-4 py-2.5 text-center text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-100/50 dark:hover:bg-red-900/20 transition-colors"
          >
            +{unreviewed.length - 5} ödev daha → Tümünü gör
          </Link>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: OgretmenDashboard'a ekle**

`app/(dashboard)/anasayfa/OgretmenDashboard.tsx` dosyasını aç.

Import'lara ekle:
```ts
import OdevCockpit from './OdevCockpit'
```

`BugunYapilacaklarWidget`'in ÜSTÜNE, mevcut `<div className="mb-5">` başlığından SONRA ekle:

```tsx
      {/* Ödev cockpit — gecikmiş giriş bekleyenler */}
      <Suspense fallback={null}>
        <OdevCockpit schoolId={profile.school_id ?? ''} />
      </Suspense>
```

`profile` bu dosyada zaten mevcut. `Suspense` zaten import edilmiş durumda kontrol et — yoksa `import { Suspense } from 'react'` ekle.

- [ ] **Step 3: TypeScript + build kontrol**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
git add app/(dashboard)/anasayfa/OdevCockpit.tsx app/(dashboard)/anasayfa/OgretmenDashboard.tsx
git commit -m "feat(homework): OdevCockpit — anasayfada gecikmiş ödev uyarısı"
```

---

## Task 6: VeliIletisimPaneli + StatusBoard Entegrasyonu

**Files:**
- Modify: `app/(dashboard)/odevler/[id]/page.tsx`
- Modify: `app/(dashboard)/odevler/[id]/StatusBoard.tsx`
- Create: `app/(dashboard)/odevler/[id]/VeliIletisimPaneli.tsx`
- Delete: `app/(dashboard)/odevler/[id]/VeliWhatsApp.tsx`

- [ ] **Step 1: page.tsx'te veli_email ekle ve VeliWhatsApp'ı kaldır**

`app/(dashboard)/odevler/[id]/page.tsx` dosyasını aç.

Students sorgusunda `veli_email` ekle:
```ts
    supabase
      .from('students')
      .select('id, full_name, student_number, veli_telefon, veli_ad, veli_email')  // veli_email eklendi
      .eq('class_id', hw.class_id)
      .eq('school_id', profile.school_id)
      .is('deleted_at', null),
```

`items` map'ine `veli_email` ekle:
```ts
    const items = students
      .map((student) => {
        const sub = subMap.get(student.id)
        return {
          student_id: student.id,
          full_name: student.full_name,
          student_number: student.student_number,
          veli_telefon: student.veli_telefon ?? null,
          veli_ad: student.veli_ad ?? null,
          veli_email: (student as typeof student & { veli_email?: string | null }).veli_email ?? null,  // yeni
          status: (sub?.status ?? 'yapilmadi') as SubmissionStatus,
          note: sub?.note ?? null,
          hasRecord: !!sub,
          missedCount: missedByStudent.get(student.id) ?? 0,
          totalHomeworks: totalHomeworkCount,
        }
      })
```

StatusBoard prop'larına `dueDate` ve `className` ekle — mevcut StatusBoard çağrısını güncelle:
```tsx
<StatusBoard
  homeworkId={id}
  items={items}
  homeworkTitle={hw.title}
  totalHomeworks={totalHomeworkCount}
  classId={hw.class_id}
  dueDate={hw.due_date ? format(parseISO(hw.due_date), 'd MMMM yyyy') : ''}
  className={cls?.name ?? ''}
/>
```

`VeliWhatsApp` import'unu ve JSX kullanımını kaldır. Dosyanın import bölümünde `import VeliWhatsApp from './VeliWhatsApp'` satırını sil. JSX'teki `<VeliWhatsApp .../>` bloğunu da sil.

- [ ] **Step 2: VeliIletisimPaneli bileşenini oluştur**

`app/(dashboard)/odevler/[id]/VeliIletisimPaneli.tsx` dosyasını oluştur:

```tsx
'use client'

import { useState, useTransition } from 'react'
import { useToast } from '@/components/Toast'
import { sendHomeworkReminderEmails } from '@/app/actions/veli-bildirim'
import type { SubmissionStatus } from '@/src/shared/types'

type VeliItem = {
  student_id: string
  full_name: string
  student_number: string | null
  status: SubmissionStatus
  veli_telefon: string | null
  veli_ad: string | null
  veli_email: string | null
}

type FilterType = 'yapilmadi' | 'eksik' | 'gec' | 'tum'

const FILTER_LABELS: Record<FilterType, string> = {
  yapilmadi: 'Yapılmadı',
  eksik:     'Eksik',
  gec:       'Geç',
  tum:       'Tümü',
}

const MISSING_STATUSES: SubmissionStatus[] = ['yapilmadi', 'eksik', 'gec']

function waLink(telefon: string): string {
  const digits = telefon.replace(/\D/g, '')
  if (digits.startsWith('90')) return `https://wa.me/${digits}`
  if (digits.startsWith('0'))  return `https://wa.me/9${digits}`
  if (digits.startsWith('5'))  return `https://wa.me/90${digits}`
  return `https://wa.me/${digits}`
}

function waMessage(ogrenciAdi: string, odevAdi: string, teslimTarihi: string, veliAdi: string | null): string {
  const hitap = veliAdi ? `Sayın ${veliAdi},` : 'Sayın veli,'
  const msg = `${hitap}\n\n${ogrenciAdi} adlı öğrencinizin "${odevAdi}" ödevi ${teslimTarihi} tarihinde teslim edilmesi gerekmektedir.\n\nLütfen ödevin tamamlandığından emin olunuz.\n\nSaygılarımla.`
  return encodeURIComponent(msg)
}

export default function VeliIletisimPaneli({
  homeworkId,
  homeworkTitle,
  dueDate,
  items,
}: {
  homeworkId: string
  homeworkTitle: string
  dueDate: string
  items: VeliItem[]
}) {
  const [filter, setFilter]         = useState<FilterType>('yapilmadi')
  const [isPending, startTransition] = useTransition()
  const { toast }                   = useToast()

  const filtered = items.filter(i => {
    if (filter === 'tum') return MISSING_STATUSES.includes(i.status)
    return i.status === filter
  })

  const withPhone = filtered.filter(i => i.veli_telefon)
  const withEmail = filtered.filter(i => i.veli_email)

  function sendEmails() {
    if (withEmail.length === 0) { toast('E-posta adresi kayıtlı veli yok', 'error'); return }
    startTransition(async () => {
      const result = await sendHomeworkReminderEmails(
        homeworkId,
        withEmail.map(i => i.student_id)
      )
      if (result.error) { toast(result.error, 'error'); return }
      toast(`${result.sent} veliye e-posta gönderildi`, 'success')
    })
  }

  const missingTotal = items.filter(i => MISSING_STATUSES.includes(i.status)).length

  if (missingTotal === 0) {
    return (
      <div className="mt-8 print:hidden">
        <p className="text-sm text-gray-400 dark:text-slate-500 text-center py-4">
          Teslim etmemiş öğrenci yok — veli bildirimi gerekmiyor.
        </p>
      </div>
    )
  }

  return (
    <div className="mt-8 print:hidden">
      <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100 mb-3">
        Ailelere Ulaş
      </h2>

      {/* Filtre butonları */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {(Object.keys(FILTER_LABELS) as FilterType[]).map(f => {
          const count = f === 'tum'
            ? missingTotal
            : items.filter(i => i.status === f).length
          if (f !== 'tum' && count === 0) return null
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                filter === f
                  ? 'bg-gray-800 dark:bg-slate-200 text-white dark:text-slate-900 border-transparent'
                  : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-400 border-gray-200 dark:border-slate-700 hover:border-gray-300'
              }`}
            >
              {FILTER_LABELS[f]} ({count})
            </button>
          )
        })}
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-slate-500 py-2">Bu filtreye uyan öğrenci yok.</p>
      ) : (
        <>
          {/* Toplu mail butonu */}
          {withEmail.length > 0 && (
            <button
              onClick={sendEmails}
              disabled={isPending}
              className="mb-3 flex items-center gap-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-2.5 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPending ? (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              )}
              {withEmail.length} veliye e-posta gönder
            </button>
          )}

          {/* Öğrenci listesi */}
          <div className="flex flex-col gap-2">
            {filtered.map(o => (
              <div
                key={o.student_id}
                className="flex items-center justify-between bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-3 gap-3 min-h-[56px]"
              >
                <span className="text-sm text-gray-800 dark:text-slate-200 truncate min-w-0">
                  {o.student_number ? `${o.student_number} — ` : ''}{o.full_name}
                  {o.veli_ad && (
                    <span className="text-xs text-gray-400 dark:text-slate-500 ml-1.5">({o.veli_ad})</span>
                  )}
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  {o.veli_email && (
                    <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium">✉</span>
                  )}
                  {o.veli_telefon && (
                    <a
                      href={`${waLink(o.veli_telefon)}?text=${waMessage(o.full_name, homeworkTitle, dueDate, o.veli_ad)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs font-medium text-white bg-green-500 hover:bg-green-600 active:bg-green-700 rounded-lg px-3 py-2 transition-colors"
                    >
                      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                      </svg>
                      WA
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 3: StatusBoard'u güncelle**

`app/(dashboard)/odevler/[id]/StatusBoard.tsx` dosyasını aç.

`StatusItem` tipine `veli_telefon`, `veli_ad`, `veli_email` ekle:

```ts
type StatusItem = {
  student_id: string
  full_name: string
  student_number: string | null
  status: SubmissionStatus
  note: string | null
  hasRecord: boolean
  missedCount: number
  totalHomeworks: number
  veli_telefon: string | null
  veli_ad: string | null
  veli_email: string | null
}
```

Props tipine `dueDate` ve `className` ekle:

```ts
export default function StatusBoard({
  homeworkId,
  items,
  homeworkTitle,
  totalHomeworks,
  classId,
  dueDate = '',
  className = '',
}: {
  homeworkId: string
  items: StatusItem[]
  homeworkTitle?: string
  totalHomeworks: number
  classId: string
  dueDate?: string
  className?: string
}) {
```

Import'lara ekle:
```ts
import VeliIletisimPaneli from './VeliIletisimPaneli'
```

`StudentHomeworkProfileModal`'in ALTINA (return JSX'inin en sonuna), `</div>` kapanışından önce ekle:

```tsx
      <VeliIletisimPaneli
        homeworkId={homeworkId}
        homeworkTitle={homeworkTitle ?? ''}
        dueDate={dueDate}
        items={items.map(i => ({
          student_id:   i.student_id,
          full_name:    i.full_name,
          student_number: i.student_number,
          status:       statuses[i.student_id] ?? i.status,
          veli_telefon: i.veli_telefon,
          veli_ad:      i.veli_ad,
          veli_email:   i.veli_email,
        }))}
      />
```

- [ ] **Step 4: VeliWhatsApp.tsx dosyasını sil**

```bash
rm "app/(dashboard)/odevler/[id]/VeliWhatsApp.tsx"
```

- [ ] **Step 5: TypeScript kontrolü**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Beklenen: Hata yok.

- [ ] **Step 6: Commit**

```bash
git add app/(dashboard)/odevler/[id]/page.tsx app/(dashboard)/odevler/[id]/StatusBoard.tsx app/(dashboard)/odevler/[id]/VeliIletisimPaneli.tsx
git rm app/(dashboard)/odevler/[id]/VeliWhatsApp.tsx
git commit -m "feat(homework): VeliIletisimPaneli — WhatsApp + mail filtreli panel"
```

---

## Task 7: sendHomeworkReminderEmails Action + Test

**Files:**
- Create: `app/actions/veli-bildirim.ts`
- Create: `tests/vitest/unit/homework/veli-bildirim.test.ts`

- [ ] **Step 1: Failing test yaz**

`tests/vitest/unit/homework/veli-bildirim.test.ts` oluştur:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createAbility } from '@/src/shared/authorization'
import { OGRETMEN_PERMS } from '../../setup/factories'
import type { GrantedPermission } from '@/src/domains/rbac/types'

const SCHOOL_HW_PERMS: GrantedPermission[] = [
  ...OGRETMEN_PERMS,
  { resource: 'homework', action: 'update', scope: 'school', source: 'role' },
]

vi.mock('@/src/shared/authorization/server', () => ({
  getAbility: vi.fn(),
}))

vi.mock('@/src/infrastructure/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/src/lib/mailer', () => ({
  mailer: { sendMail: vi.fn() },
}))

const { getAbility }   = await import('@/src/shared/authorization/server')
const { createClient } = await import('@/src/infrastructure/supabase/server')
const { mailer }       = await import('@/src/lib/mailer')
const { sendHomeworkReminderEmails } = await import('@/app/actions/veli-bildirim')

const SCHOOL_ID  = 'school-1'
const TEACHER_ID = 'teacher-1'
const OTHER_ID   = 'other-1'

function makeAbility(perms = OGRETMEN_PERMS, userId = TEACHER_ID) {
  return createAbility({ userId, schoolId: SCHOOL_ID, permissions: perms })
}

function makeSupabase(hwData: unknown, studentsData: unknown) {
  const singleFn  = vi.fn().mockResolvedValue({ data: hwData, error: null })
  const selectFn  = vi.fn().mockReturnThis()
  const eqFn      = vi.fn().mockReturnThis()
  const inFn      = vi.fn().mockReturnThis()
  const notFn     = vi.fn().mockReturnThis()
  const studentsSelectFn = vi.fn().mockResolvedValue({ data: studentsData, error: null })

  return {
    from: vi.fn((table: string) => ({
      select: table === 'homeworks'
        ? vi.fn().mockReturnValue({ eq: eqFn, is: vi.fn().mockReturnThis(), single: singleFn })
        : vi.fn().mockReturnValue({ eq: eqFn, not: notFn, in: inFn, then: studentsSelectFn }),
    })),
  }
}

beforeEach(() => { vi.clearAllMocks() })

describe('sendHomeworkReminderEmails()', () => {
  it('giriş yoksa { error } döner', async () => {
    vi.mocked(getAbility).mockResolvedValue(null)
    const result = await sendHomeworkReminderEmails('hw-1', ['stu-1'])
    expect(result.error).toBe('Giriş gerekli')
    expect(mailer.sendMail).not.toHaveBeenCalled()
  })

  it('homework:update izni yoksa hata döner', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility([]) as never)
    const result = await sendHomeworkReminderEmails('hw-1', ['stu-1'])
    expect(result.error).toBe('Bu işlem için yetkiniz yok.')
  })

  it('boş studentIds ile çağrılınca sent=0 döner, mail gönderilmez', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility() as never)
    vi.mocked(createClient).mockResolvedValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { teacher_id: TEACHER_ID }, error: null }),
      }),
    } as never)
    const result = await sendHomeworkReminderEmails('hw-1', [])
    expect(result.sent).toBe(0)
    expect(mailer.sendMail).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Testi çalıştır — FAIL bekliyoruz**

```bash
npx vitest run tests/vitest/unit/homework/veli-bildirim.test.ts
```

Beklenen: `Cannot find module '@/app/actions/veli-bildirim'` hatası.

- [ ] **Step 3: Action'ı yaz**

`app/actions/veli-bildirim.ts` oluştur:

```ts
'use server'

import { UUID } from '@/src/shared/validation'
import { getAbility } from '@/src/shared/authorization/server'
import { P } from '@/src/shared/permissions'
import { createClient } from '@/src/infrastructure/supabase/server'
import { mailer } from '@/src/lib/mailer'

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

export async function sendHomeworkReminderEmails(
  homeworkId: string,
  studentIds: string[]
): Promise<{ error?: string; sent?: number; failed?: number }> {
  UUID.parse(homeworkId)
  studentIds.forEach(id => UUID.parse(id))

  const ability = await getAbility()
  if (!ability) return { error: 'Giriş gerekli' }
  if (ability.cannot(P.HOMEWORK.UPDATE)) return { error: 'Bu işlem için yetkiniz yok.' }

  if (studentIds.length === 0) return { sent: 0 }

  const supabase = await createClient()

  // RBAC: ödev bu öğretmene ait mi kontrol et
  const { data: hw } = await supabase
    .from('homeworks')
    .select('teacher_id, title, due_date, school_id')
    .eq('id', homeworkId)
    .eq('school_id', ability.schoolId)
    .is('deleted_at', null)
    .single()

  if (!hw) return { error: 'Ödev bulunamadı' }

  const isManager = ability.scope(P.HOMEWORK.UPDATE) === 'school'
  if (!isManager && hw.teacher_id !== ability.userId) {
    return { error: 'Bu ödev için yetkiniz yok' }
  }

  // Öğrencilerin veli_email'lerini çek
  const { data: students } = await supabase
    .from('students')
    .select('id, full_name, veli_email, veli_ad')
    .in('id', studentIds)
    .eq('school_id', ability.schoolId)
    .not('veli_email', 'is', null)
    .eq('veli_email_opt_out', false)

  const targets = (students ?? []).filter(s => s.veli_email)
  if (targets.length === 0) return { sent: 0 }

  const dueDateStr = hw.due_date ?? ''

  const results = await Promise.allSettled(
    targets.map(s =>
      mailer.sendMail({
        to: s.veli_email!,
        subject: `Ödev Hatırlatması — ${s.full_name}`,
        html: `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>body{font-family:sans-serif;color:#1f2937;line-height:1.6}
.box{max-width:520px;margin:32px auto;padding:32px;border:1px solid #e5e7eb;border-radius:12px}
.badge{display:inline-block;background:#eff6ff;color:#1d4ed8;padding:4px 10px;border-radius:6px;font-size:13px;font-weight:600}
.footer{margin-top:24px;padding-top:16px;border-top:1px solid #f3f4f6;font-size:12px;color:#9ca3af}
</style></head>
<body><div class="box">
<p>${esc(s.veli_ad ?? 'Sayın Veli')},</p>
<p><strong>${esc(s.full_name)}</strong> adlı öğrencinizin</p>
<p class="badge">"${esc(hw.title)}"</p>
<p>adlı ödevi${dueDateStr ? ` <strong>${esc(dueDateStr)}</strong> tarihinde` : ''} teslim edilmesi gerekmektedir.</p>
<p>Lütfen ödevin tamamlandığından emin olunuz.</p>
<div class="footer">EduDesk — Okul Takip Sistemi</div>
</div></body></html>`,
      })
    )
  )

  const sent   = results.filter(r => r.status === 'fulfilled').length
  const failed = results.filter(r => r.status === 'rejected').length

  return { sent, failed: failed > 0 ? failed : undefined }
}
```

- [ ] **Step 4: Testi çalıştır — PASS bekliyoruz**

```bash
npx vitest run tests/vitest/unit/homework/veli-bildirim.test.ts
```

Beklenen: Tüm testler PASS.

- [ ] **Step 5: Tüm unit testler yeşil mi**

```bash
npm run test:unit
```

- [ ] **Step 6: Commit**

```bash
git add app/actions/veli-bildirim.ts tests/vitest/unit/homework/veli-bildirim.test.ts
git commit -m "feat(homework): sendHomeworkReminderEmails action + testler"
```

---

## Task 8: homeworkCreatedNotifier Inngest Function

**Files:**
- Create: `src/domains/notifications/functions/homeworkCreatedNotifier.ts`
- Modify: `app/api/inngest/route.ts`
- Modify: `app/actions/homework.ts`

- [ ] **Step 1: Inngest function yaz**

`src/domains/notifications/functions/homeworkCreatedNotifier.ts` oluştur:

```ts
import { inngest } from '@/src/infrastructure/inngest'
import { createServiceClient } from '@/src/infrastructure/supabase/service'
import { mailer } from '@/src/lib/mailer'

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

export const homeworkCreatedNotifierFn = inngest.createFunction(
  { id: 'homework-created-notifier' },
  { event: 'homework/created' },
  async ({ event, step }) => {
    const { homeworkId, classId, schoolId } = event.data as {
      homeworkId: string
      classId: string
      schoolId: string
    }

    const hw = await step.run('fetch-homework', async () => {
      const supabase = createServiceClient()
      const { data } = await supabase
        .from('homeworks')
        .select('id, title, due_date, is_template')
        .eq('id', homeworkId)
        .eq('school_id', schoolId)
        .is('deleted_at', null)
        .single()
      return data
    })

    if (!hw || hw.is_template) return { skipped: 'şablon veya bulunamadı' }

    const targets = await step.run('fetch-veliler', async () => {
      const supabase = createServiceClient()
      const { data } = await supabase
        .from('students')
        .select('id, full_name, veli_email, veli_ad')
        .eq('class_id', classId)
        .eq('school_id', schoolId)
        .is('deleted_at', null)
        .not('veli_email', 'is', null)
        .eq('veli_email_opt_out', false)
      return (data ?? []).filter(s => s.veli_email)
    })

    if (!targets.length) return { sent: 0, reason: 'veli-email-yok' }

    await step.run('send-emails', async () => {
      const results = await Promise.allSettled(
        targets.slice(0, 50).map(s =>
          mailer.sendMail({
            to: s.veli_email!,
            subject: `Yeni Ödev: ${hw.title}`,
            html: `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>body{font-family:sans-serif;color:#1f2937;line-height:1.6}
.box{max-width:520px;margin:32px auto;padding:32px;border:1px solid #e5e7eb;border-radius:12px}
.badge{display:inline-block;background:#eff6ff;color:#1d4ed8;padding:4px 10px;border-radius:6px;font-size:13px;font-weight:600}
.footer{margin-top:24px;padding-top:16px;border-top:1px solid #f3f4f6;font-size:12px;color:#9ca3af}
</style></head>
<body><div class="box">
<p>${esc(s.veli_ad ?? 'Sayın Veli')},</p>
<p><strong>${esc(s.full_name)}</strong> için yeni bir ödev tanımlandı:</p>
<p class="badge">"${esc(hw.title)}"</p>
${hw.due_date ? `<p>Son teslim tarihi: <strong>${esc(hw.due_date)}</strong></p>` : ''}
<div class="footer">EduDesk — Okul Takip Sistemi</div>
</div></body></html>`,
          })
        )
      )
      const failed = results.filter(r => r.status === 'rejected').length
      if (failed) console.error(`[homeworkCreatedNotifier] ${failed}/${targets.length} mail gönderilemedi`)
    })

    return { sent: Math.min(targets.length, 50) }
  }
)
```

- [ ] **Step 2: Inngest route'a kaydet**

`app/api/inngest/route.ts` dosyasını aç. Import'a ekle:

```ts
import { homeworkCreatedNotifierFn } from '@/src/domains/notifications/functions/homeworkCreatedNotifier'
```

`functions` dizisine ekle:

```ts
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    exportXlsxFn,
    exportDeadLetterFn,
    homeworkReminderFn,
    veliAbsenceNotifierFn,
    aylikBultenFn,
    odevSonrasiVeliNotifierFn,
    homeworkCreatedNotifierFn,   // yeni
  ],
})
```

- [ ] **Step 3: quickCreateHomework action'da Inngest event tetikle**

`app/actions/homework.ts` dosyasını aç. Import'lara ekle:

```ts
import { inngest } from '@/src/infrastructure/inngest'
import { getCurrentProfile } from '@/src/shared/auth'
```

`quickCreateHomework` fonksiyonunda, `revalidatePath` çağrılarından ÖNCE şunu ekle:

```ts
  // Inngest — veli bildirimi
  const notifyParents = formData.get('notify_parents') === 'true'
  if (notifyParents && ids.length > 0) {
    const profile = await getCurrentProfile()
    if (profile?.school_id) {
      await Promise.allSettled(
        classIds.slice(0, ids.length).map((classId, idx) =>
          inngest.send({
            name: 'homework/created',
            data: { homeworkId: ids[idx], classId, schoolId: profile.school_id! },
          })
        )
      )
    }
  }
```

- [ ] **Step 4: TypeScript kontrolü**

```bash
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 5: Tüm unit testler hâlâ yeşil mi**

```bash
npm run test:unit
```

Beklenen: Tüm testler PASS.

- [ ] **Step 6: Commit**

```bash
git add src/domains/notifications/functions/homeworkCreatedNotifier.ts app/api/inngest/route.ts app/actions/homework.ts
git commit -m "feat(homework): homeworkCreatedNotifier Inngest function + quickCreateHomework veli trigger"
```

---

## Task 9: Son Kontrol — Temizlik ve Doğrulama

**Files:**
- Verify: Tüm dosyalar TypeScript uyumlu
- Verify: Tüm testler yeşil

- [ ] **Step 1: Tüm unit testler**

```bash
npm run test:unit
```

Beklenen: 163+ test, tümü PASS.

- [ ] **Step 2: TypeScript build**

```bash
npx tsc --noEmit 2>&1
```

Beklenen: Hata yok.

- [ ] **Step 3: Dev sunucusu çalıştır ve üç paketi doğrula**

```bash
npm run dev
```

Kontrol listesi:
- [ ] Sağ altta FAB görünüyor (öğretmen rolüyle)
- [ ] FAB'a tıklayınca drawer açılıyor
- [ ] Sınıf seçince şablonlar yükleniyor (şablon varsa)
- [ ] Ödev oluşturulunca toast çıkıyor, drawer kapanıyor
- [ ] Anasayfada gecikmiş + girişsiz ödev varsa kırmızı alert görünüyor
- [ ] Ödev detay sayfasında (odevler/[id]) alt kısımda "Ailelere Ulaş" paneli var
- [ ] Yapılmadı / Eksik / Geç / Tümü filtre butonları çalışıyor
- [ ] E-posta butonu görünüyor (veli_email kayıtlı öğrenci varsa)
- [ ] WhatsApp linkleri açılıyor

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore: ödev sistemi iyileştirme — final doğrulama"
```
