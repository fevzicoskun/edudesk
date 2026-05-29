# UX İyileştirmeleri Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 7 UX sorununu düzelt: ödev çoğaltma, yoklama devamsızlık sayacı, anasayfa tıklanabilir kartlar, sınav widget iyileştirmesi, inline tooltip, sidebar Öğretmen Dosyası/Zümre Bildirimi temizliği.

**Architecture:** Tüm değişiklikler mevcut dosyaları düzenliyor; yeni sayfa/tablo yok. Sidebar nav'dan 2 item kaldırılıyor, Profil sekmelerine taşınıyor. Ödev formu query-param üzerinden pre-fill alıyor. YoklamaPage server component'inde ek DB sorgusu.

**Tech Stack:** Next.js App Router, React Server Components, Supabase, TypeScript, Tailwind v4

---

## Dosya Haritası

| Dosya | İşlem |
|---|---|
| `components/layout/Sidebar.tsx` | Modify — 2 navItem kaldır, Duyurular rolüne zumre_baskani ekle |
| `app/(dashboard)/profil/page.tsx` | Modify — Dosyam + Öğretmen Dosyası sekmeleri ekle |
| `app/(dashboard)/profil/dosyam/page.tsx` | Modify — aynı 3-sekme nav |
| `app/(dashboard)/ogretmen-dosyasi/page.tsx` | Modify — aynı 3-sekme nav |
| `app/(dashboard)/duyurular/page.tsx` | Modify — zumre_baskani erişim + ZumreDuyuruForm |
| `app/(dashboard)/odevler/yeni/page.tsx` | Modify — `copy` search param ile pre-fill |
| `app/(dashboard)/odevler/yeni/HomeworkForm.tsx` | Modify — `defaults` prop ekle |
| `app/(dashboard)/odevler/[id]/page.tsx` | Modify — "Kopyala" linki ekle |
| `app/(dashboard)/yoklama/page.tsx` | Modify — devamsızlık sayılarını fetch et, props'a ekle |
| `app/(dashboard)/yoklama/YoklamaClient.tsx` | Modify — badge göster, öğrenci profiline link |
| `app/(dashboard)/anasayfa/OgretmenDashboard.tsx` | Modify — SummaryCard href prop, risk section id |
| `app/(dashboard)/anasayfa/SinavOrtalamaWidget.tsx` | Modify — karne özeti satırı |
| `components/ui/Tooltip.tsx` | Create — hover tooltip bileşeni |

---

## Task 1: Sidebar Temizliği

**Files:**
- Modify: `zumre-takip/components/layout/Sidebar.tsx`

- [ ] **Adım 1:** Sidebar.tsx'i aç, `navItems` dizisini bul (satır 28)

- [ ] **Adım 2:** `ogretmen-dosyasi` ve `zumre-duyuru` entry'lerini kaldır. `duyurular` entry'sinin `roles` alanına `'zumre_baskani'` ekle.

Mevcut (kaldırılacak) item'lar:
```typescript
// Bu iki item'ı komple sil:
{
  href: '/ogretmen-dosyasi',
  label: 'Öğretmen Dosyası',
  mobile: false,
  roles: ['ogretmen', 'zumre_baskani'],
  icon: <svg ...>,
},
{
  href: '/zumre-duyuru',
  label: 'Zümre Bildirimi',
  mobile: false,
  roles: ['zumre_baskani'],
  icon: <svg ...>,
},
```

`duyurular` item'ını şu şekilde güncelle:
```typescript
{
  href: '/duyurular',
  label: 'Duyurular',
  mobile: false,
  roles: ['mudur', 'mudur_yardimcisi', 'zumre_baskani'],  // zumre_baskani eklendi
  icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>,
},
```

- [ ] **Adım 3:** TypeScript hatası yoktur, `npm run build 2>&1 | head -20` ile kontrol et (zorunlu değil, hızlı check)

- [ ] **Adım 4:** Commit
```bash
git add components/layout/Sidebar.tsx
git commit -m "feat: sidebar'dan Öğretmen Dosyası ve Zümre Bildirimi kaldırıldı, Duyurular zumre_baskani'na açıldı"
```

---

## Task 2: Duyurular Sayfası — Zümre Başkanı Desteği

**Files:**
- Modify: `zumre-takip/app/(dashboard)/duyurular/page.tsx`

- [ ] **Adım 1:** `duyurular/page.tsx`'i aç

- [ ] **Adım 2:** İzin guard'ını ve içeriği şu şekilde güncelle:

```typescript
import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/src/shared/auth'
import { AnnouncementService } from '@/src/domains/announcements/services/AnnouncementService'
import { MUDUR_TARGET_ROLES, MY_TARGET_ROLES } from '@/src/domains/announcements/validators'
import { ROLE_LABELS } from '@/src/shared/types'
import { format } from '@/src/shared/date'
import DuyuruForm from './DuyuruForm'
import ZumreDuyuruForm from '../zumre-duyuru/ZumreDuyuruForm'

export const dynamic = 'force-dynamic'

const ALLOWED = ['mudur', 'mudur_yardimcisi', 'zumre_baskani']

export default async function DuyurularPage() {
  const profile = await getCurrentProfile()
  if (!profile || !ALLOWED.includes(profile.role)) {
    redirect('/anasayfa')
  }

  const isZumreBaskani = profile.role === 'zumre_baskani'
  const allowedRoles = profile.role === 'mudur' ? MUDUR_TARGET_ROLES : MY_TARGET_ROLES
  const sent = isZumreBaskani ? [] : await AnnouncementService.listSent()

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">Duyurular</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
          {isZumreBaskani
            ? `${profile.subject ?? ''} zümresine bildirim gönder`
            : 'Hedef gruba duyuru gönderin'}
        </p>
      </div>

      {isZumreBaskani ? (
        <ZumreDuyuruForm />
      ) : (
        <>
          <DuyuruForm allowedRoles={allowedRoles as readonly string[]} />
          {sent.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">
                Gönderilen Duyurular
              </h2>
              <div className="space-y-2">
                {sent.map(a => (
                  <div
                    key={a.id}
                    className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex flex-wrap gap-1">
                        {a.target_roles.map(r => (
                          <span
                            key={r}
                            className="text-[11px] px-2 py-0.5 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 rounded-full font-medium"
                          >
                            {ROLE_LABELS[r as keyof typeof ROLE_LABELS] ?? r}
                          </span>
                        ))}
                      </div>
                      <span className="text-xs text-gray-400 dark:text-slate-500 shrink-0">
                        {format(new Date(a.created_at), 'd MMM yyyy')}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 dark:text-slate-300 line-clamp-3 whitespace-pre-wrap">
                      {a.message}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
```

- [ ] **Adım 3:** Commit
```bash
git add app/\(dashboard\)/duyurular/page.tsx
git commit -m "feat: duyurular sayfası zümre başkanına açıldı, ZumreDuyuruForm entegre edildi"
```

---

## Task 3: Profil — Üç Sekme Navigasyonu

**Files:**
- Modify: `zumre-takip/app/(dashboard)/profil/page.tsx`
- Modify: `zumre-takip/app/(dashboard)/profil/dosyam/page.tsx`
- Modify: `zumre-takip/app/(dashboard)/ogretmen-dosyasi/page.tsx`

Bu üç sayfa aynı `TabNav` alt bileşeni paylaşacak.

- [ ] **Adım 1:** `app/(dashboard)/profil/page.tsx`'i güncelle:

```typescript
export const revalidate = 300

import { getCurrentUser, getCurrentProfile } from '@/src/shared/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import ProfilForm from './ProfilForm'
import { isTeachingRole } from '@/src/shared/types'

function ProfilTabNav({ active, showTeacherTabs }: { active: 'profil' | 'dosyam' | 'ogretmen-dosyasi'; showTeacherTabs: boolean }) {
  const tabs = [
    { href: '/profil', key: 'profil' as const, label: 'Profilim' },
    ...(showTeacherTabs ? [
      { href: '/profil/dosyam', key: 'dosyam' as const, label: 'Dosyam' },
      { href: '/ogretmen-dosyasi', key: 'ogretmen-dosyasi' as const, label: 'Öğretmen Dosyası' },
    ] : []),
  ]

  return (
    <div className="flex gap-1 border-b border-gray-200 dark:border-slate-700 mb-6">
      {tabs.map(t => (
        t.key === active ? (
          <span key={t.key} className="px-4 py-2 text-sm font-medium border-b-2 border-blue-600 text-blue-600">
            {t.label}
          </span>
        ) : (
          <Link key={t.key} href={t.href} className="px-4 py-2 text-sm font-medium text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200">
            {t.label}
          </Link>
        )
      ))}
    </div>
  )
}

export default async function ProfilPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const profile = await getCurrentProfile()
  const showTeacherTabs = isTeachingRole(profile?.role)

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <ProfilTabNav active="profil" showTeacherTabs={showTeacherTabs} />
      <ProfilForm
        defaultFullName={profile?.full_name ?? ''}
        defaultSubject={profile?.subject ?? ''}
        schoolName={profile?.schools?.name ?? null}
        email={user.email ?? ''}
        role={profile?.role ?? 'ogretmen'}
      />
    </div>
  )
}
```

Not: `ProfilTabNav` Server Component'e wrapper, `usePathname` kullanmıyoruz — `active` prop ile manuel belirliyoruz.

- [ ] **Adım 2:** `app/(dashboard)/profil/dosyam/page.tsx` başına `ProfilTabNav` ekle.

Mevcut dosyada `return (` satırının içine, `div` wrapper'ına `px-4 md:px-6` ekle ve `ProfilTabNav` inject et. Mevcut `flex gap-1 border-b` kısmını `ProfilTabNav` ile değiştir:

```typescript
// dosyam/page.tsx — sadece değişen kısım
// Dosyanın başına import ekle:
import { isTeachingRole } from '@/src/shared/types'

// ProfilTabNav fonksiyonunu dosyam/page.tsx'e de kopyala (aynı kod)
// ...veya ortak bir dosyaya çıkar — aşağıda açıklandı

// return içinde:
return (
  <div className="p-4 md:p-6 max-w-3xl mx-auto">
    <ProfilTabNav active="dosyam" showTeacherTabs={true} />
    {/* mevcut içerik devam ediyor... */}
    <div className="bg-gradient-to-r from-blue-900 to-blue-700 ...">
```

Mevcut `div className="flex gap-1 border-b border-gray-200 mb-6"` bloğunu kaldır, yerine `<ProfilTabNav active="dosyam" showTeacherTabs={true} />` koy.

- [ ] **Adım 3:** `ProfilTabNav` tekrar etmesin diye ortak bir dosyaya çıkar:

`app/(dashboard)/profil/ProfilTabNav.tsx` oluştur:
```typescript
import Link from 'next/link'

export default function ProfilTabNav({
  active,
  showTeacherTabs,
}: {
  active: 'profil' | 'dosyam' | 'ogretmen-dosyasi'
  showTeacherTabs: boolean
}) {
  const tabs = [
    { href: '/profil', key: 'profil' as const, label: 'Profilim' },
    ...(showTeacherTabs ? [
      { href: '/profil/dosyam', key: 'dosyam' as const, label: 'Dosyam' },
      { href: '/ogretmen-dosyasi', key: 'ogretmen-dosyasi' as const, label: 'Öğretmen Dosyası' },
    ] : []),
  ]

  return (
    <div className="flex gap-1 border-b border-gray-200 dark:border-slate-700 mb-6">
      {tabs.map(t =>
        t.key === active ? (
          <span key={t.key} className="px-4 py-2 text-sm font-medium border-b-2 border-blue-600 text-blue-600">
            {t.label}
          </span>
        ) : (
          <Link
            key={t.key}
            href={t.href}
            className="px-4 py-2 text-sm font-medium text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200"
          >
            {t.label}
          </Link>
        )
      )}
    </div>
  )
}
```

- [ ] **Adım 4:** `profil/page.tsx` ve `profil/dosyam/page.tsx`'deki inline `ProfilTabNav` tanımını kaldır, `import ProfilTabNav from './ProfilTabNav'` ekle.

- [ ] **Adım 5:** `app/(dashboard)/ogretmen-dosyasi/page.tsx` başına `ProfilTabNav` ekle:

```typescript
// ogretmen-dosyasi/page.tsx
import { getCurrentProfile } from '@/src/shared/auth'
import { redirect }          from 'next/navigation'
import { createClient }      from '@/src/infrastructure/supabase/server'
import ChecklistClient       from './ChecklistClient'
import ProfilTabNav          from '../profil/ProfilTabNav'   // ← eklendi

function getCurrentAcademicYear(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const start = month >= 9 ? year : year - 1
  return `${start}-${start + 1}`
}

export default async function OgretmenDosyasiPage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')

  const supabase = await createClient()
  const academicYear = getCurrentAcademicYear()

  const { data } = await supabase
    .from('ogretmen_dosyasi')
    .select('checked_items')
    .eq('teacher_id', profile.id)
    .eq('academic_year', academicYear)
    .maybeSingle()

  const checkedItems: string[] = data?.checked_items ?? []

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <ProfilTabNav active="ogretmen-dosyasi" showTeacherTabs={true} />
      <h1 className="text-lg font-bold text-gray-900 dark:text-slate-100 mb-1">Öğretmen Dosyası</h1>
      <p className="text-xs text-gray-400 dark:text-slate-500 mb-5">
        Dosyanızda bulunması gereken belgeleri işaretleyin.
      </p>
      <ChecklistClient initialChecked={checkedItems} academicYear={academicYear} />
    </div>
  )
}
```

- [ ] **Adım 6:** Commit
```bash
git add app/\(dashboard\)/profil/ app/\(dashboard\)/ogretmen-dosyasi/page.tsx
git commit -m "feat: profil/dosyam/öğretmen dosyası sekme navigasyonu, sidebar'dan taşındı"
```

---

## Task 4: Ödev Çoğaltma

**Files:**
- Modify: `zumre-takip/app/(dashboard)/odevler/yeni/page.tsx`
- Modify: `zumre-takip/app/(dashboard)/odevler/yeni/HomeworkForm.tsx`
- Modify: `zumre-takip/app/(dashboard)/odevler/[id]/page.tsx`

- [ ] **Adım 1:** `HomeworkForm.tsx`'e `defaults` prop ekle. `type` tanımlarından sonra `Defaults` type'ı ekle ve component imzasını güncelle:

```typescript
type Defaults = {
  title?: string
  subject?: string
  description?: string | null
  class_id?: string
  source_id?: string | null
}

export default function HomeworkForm({
  classes,
  sources,
  defaults,
}: {
  classes: ClassItem[]
  sources: SourceItem[]
  defaults?: Defaults
}) {
```

- [ ] **Adım 2:** Form elemanlarına `defaultValue` ekle (tüm değişiklikler `HomeworkForm.tsx` içinde):

```typescript
// Sınıf select:
<select name="class_id" required className={field} defaultValue={defaults?.class_id ?? ''}>

// Ders input:
<input name="subject" type="text" required placeholder="Matematik" className={field} defaultValue={defaults?.subject ?? ''} />

// Başlık input:
<input name="title" type="text" required placeholder="Ödev başlığını girin" className={field} defaultValue={defaults?.title ?? ''} />

// Açıklama textarea:
<textarea name="description" rows={3} className={`${field} resize-none`} defaultValue={defaults?.description ?? ''} />

// Kaynak select (mevcut options'dan önce):
<select name="source_id" className={field} defaultValue={defaults?.source_id ?? ''}>

// due_date alanı değiştirilmiyor (kopya için yeni tarih seçilmeli)
```

Header subtitle'ı da güncelle:
```typescript
// Mevcut:
<p className="text-blue-200 text-sm mt-0.5">Öğrencilerinize yeni bir görev tanımlayın</p>
// defaults varsa:
<p className="text-blue-200 text-sm mt-0.5">
  {defaults ? 'Kopyadan yeni ödev oluşturun' : 'Öğrencilerinize yeni bir görev tanımlayın'}
</p>
```

- [ ] **Adım 3:** `app/(dashboard)/odevler/yeni/page.tsx`'i `copy` search param'ı okuyacak şekilde güncelle:

```typescript
import { createClient } from '@/src/infrastructure/supabase/server'
import { getCurrentProfile } from '@/src/shared/auth'
import { isMudurOrAbove } from '@/src/shared/types'
import { redirect } from 'next/navigation'
import HomeworkForm from './HomeworkForm'
import Link from 'next/link'

export default async function YeniOdevPage({
  searchParams,
}: {
  searchParams: Promise<{ copy?: string }>
}) {
  const profile = await getCurrentProfile()
  if (profile && isMudurOrAbove(profile.role)) redirect('/odevler')

  const { copy } = await searchParams

  const supabase = await createClient()
  const [classesRes, sourcesRes] = await Promise.all([
    supabase
      .from('classes')
      .select('id, name, grade')
      .eq('school_id', profile?.school_id ?? '')
      .order('grade')
      .order('name'),
    supabase
      .from('homework_sources')
      .select('id, name, subject')
      .eq('teacher_id', profile?.id ?? '')
      .eq('school_id', profile?.school_id ?? '')
      .eq('active', true)
      .order('name'),
  ])

  let defaults: { title?: string; subject?: string; description?: string | null; class_id?: string; source_id?: string | null } | undefined

  if (copy) {
    const { data: original } = await supabase
      .from('homeworks')
      .select('title, subject, description, source_id')
      .eq('id', copy)
      .eq('school_id', profile?.school_id ?? '')
      .is('deleted_at', null)
      .single()
    if (original) {
      defaults = {
        title: `${original.title} (Kopya)`,
        subject: original.subject ?? '',
        description: original.description,
        source_id: original.source_id,
      }
    }
  }

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-50 via-red-50/20 to-slate-50">
      <div className="p-4 md:p-6 max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/odevler"
            className="flex items-center justify-center w-9 h-9 rounded-xl bg-white border border-gray-200 text-gray-500 hover:text-gray-800 hover:border-gray-300 shadow-sm hover:shadow transition-all duration-200"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-base font-bold text-gray-900 leading-tight">
              {defaults ? 'Ödev Kopyala' : 'Ödev Oluştur'}
            </h1>
            <p className="text-xs text-gray-500">
              {defaults ? 'Sınıf ve tarihi seçerek kopyayı kaydedin' : 'Sınıfınıza yeni bir görev tanımlayın'}
            </p>
          </div>
        </div>
        <HomeworkForm
          classes={classesRes.data ?? []}
          sources={sourcesRes.data ?? []}
          defaults={defaults}
        />
      </div>
    </div>
  )
}
```

- [ ] **Adım 4:** `app/(dashboard)/odevler/[id]/page.tsx`'e "Kopyala" linki ekle. `← Ödevler` linkinin yanına:

```typescript
// Mevcut (satır 68-73 civarı):
<div className="flex items-center justify-between mb-3 print:hidden">
  <Link href="/odevler" className="text-sm text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200">
    ← Ödevler
  </Link>
  <PrintButton />
</div>

// Yeni (PrintButton'dan önce Kopyala linki):
<div className="flex items-center justify-between mb-3 print:hidden">
  <Link href="/odevler" className="text-sm text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200">
    ← Ödevler
  </Link>
  <div className="flex items-center gap-2">
    <Link
      href={`/odevler/yeni?copy=${id}`}
      className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 px-2.5 py-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors"
    >
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
      Kopyala
    </Link>
    <PrintButton />
  </div>
</div>
```

Not: "Kopyala" linki sadece `canWrite` true iken gösterilmeli. `canWrite` kontrol ekle:
```typescript
// hw fetch'ten sonra canWrite hesapla:
const isZumreBaskani = profile.role === 'zumre_baskani' || isMudurOrAbove(profile.role)
const canWrite = isTeachingRole(profile.role)  // sadece öğretmen/zumre_baskani

// "Kopyala" linki canWrite kontrolü:
{canWrite && (
  <Link href={`/odevler/yeni?copy=${id}`} ...>
    Kopyala
  </Link>
)}
```

`isTeachingRole` import'u ekle: `import { isMudurOrAbove, isTeachingRole } from '@/src/shared/types'`

- [ ] **Adım 5:** Commit
```bash
git add app/\(dashboard\)/odevler/yeni/ app/\(dashboard\)/odevler/\[id\]/page.tsx
git commit -m "feat: ödev çoğaltma — ?copy param ile başlık/ders/açıklama pre-fill"
```

---

## Task 5: Yoklama — Devamsızlık Sayacı

**Files:**
- Modify: `zumre-takip/app/(dashboard)/yoklama/page.tsx`
- Modify: `zumre-takip/app/(dashboard)/yoklama/YoklamaClient.tsx`

- [ ] **Adım 1:** `yoklama/page.tsx`'e devamsızlık sayılarını ekle:

```typescript
export const revalidate = 30

import { createClient } from '@/src/infrastructure/supabase/server'
import { getCurrentProfile } from '@/src/shared/auth'
import { getEgitimYili, schoolYearStart } from '@/src/shared/utils'
import YoklamaClient from './YoklamaClient'

export default async function YoklamaPage() {
  const [supabase, profile] = await Promise.all([createClient(), getCurrentProfile()])
  if (!profile?.school_id) return null

  const { data: rawClasses } = await supabase
    .from('classes')
    .select('id, name, grade, students(id, full_name, student_number, deleted_at)')
    .eq('school_id', profile.school_id)
    .is('deleted_at', null)
    .order('grade')
    .order('name')

  const classes: ClassWithStudents[] = (rawClasses ?? []).map(cls => ({
    ...cls,
    students: ((cls.students ?? []) as (Student & { deleted_at: string | null })[])
      .filter(s => !s.deleted_at),
  }))

  // Yıl içi devamsızlık sayaçları
  const studentIds = classes.flatMap(c => c.students.map(s => s.id))
  const absenceCounts: Record<string, number> = {}

  if (studentIds.length > 0) {
    const { data: absences } = await supabase
      .from('attendance')
      .select('student_id, status')
      .eq('school_id', profile.school_id)
      .in('student_id', studentIds)
      .gte('date', schoolYearStart())
      .in('status', ['absent', 'late'])

    for (const a of absences ?? []) {
      const increment = a.status === 'absent' ? 1 : 0.5
      absenceCounts[a.student_id] = (absenceCounts[a.student_id] ?? 0) + increment
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">Yoklama</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">{getEgitimYili()} — Devamsız öğrencilerin velisine otomatik e-posta gider</p>
      </div>
      <YoklamaClient classes={classes} absenceCounts={absenceCounts} />
    </div>
  )
}

interface Student          { id: string; full_name: string; student_number: string | null }
export interface ClassWithStudents { id: string; name: string; grade: number; students: Student[] }
```

- [ ] **Adım 2:** `YoklamaClient.tsx`'e `absenceCounts` prop ve badge ekle.

Props interface'ini güncelle:
```typescript
interface Props {
  classes: ClassWithStudents[]
  absenceCounts: Record<string, number>
}
```

Component signature:
```typescript
export default function YoklamaClient({ classes, absenceCounts }: Props) {
```

Öğrenci adının yanına devamsızlık badge'i ekle. Mevcut öğrenci satırını bul (student.full_name render edildiği yer) ve şu şekilde güncelle:

```typescript
// Mevcut öğrenci render alanında (student full_name gösterildiği yerde):
<div className="flex items-center gap-2 min-w-0">
  <span className="font-medium text-gray-900 dark:text-slate-100 truncate text-sm">
    {student.full_name}
  </span>
  {(() => {
    const absent = absenceCounts[student.id] ?? 0
    if (absent === 0) return null
    const danger = absent >= 20
    const warn   = absent >= 15
    return (
      <span
        className={`shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
          danger ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
          : warn  ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
          :         'bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-slate-400'
        }`}
        title={`Yıl içi devamsızlık: ${absent} gün (MEB sınırı: 20 gün)`}
      >
        {absent}g
      </span>
    )
  })()}
</div>
```

- [ ] **Adım 3:** Commit
```bash
git add app/\(dashboard\)/yoklama/
git commit -m "feat: yoklama listesinde yıl içi devamsızlık sayacı badge'i"
```

---

## Task 6: Anasayfa Summary Card'ları Tıklanabilir

**Files:**
- Modify: `zumre-takip/app/(dashboard)/anasayfa/OgretmenDashboard.tsx`

- [ ] **Adım 1:** `SummaryCard` bileşenini `href` destekleyecek şekilde güncelle:

```typescript
import Link from 'next/link'

// Mevcut type:
// function SummaryCard({ label, value, tone }: { label: string; value: number; tone: Tone })

// Yeni:
function SummaryCard({ label, value, tone, href }: { label: string; value: number; tone: Tone; href?: string }) {
  const className = `border rounded-xl p-4 transition-opacity ${TONE[tone]} ${href ? 'hover:opacity-80 cursor-pointer' : ''}`
  const inner = (
    <>
      <p className="text-3xl font-bold">{value}</p>
      <p className="text-xs mt-1 opacity-90">{label}</p>
    </>
  )
  if (href) return <Link href={href} className={className}>{inner}</Link>
  return <div className={className}>{inner}</div>
}
```

- [ ] **Adım 2:** 3 karta `href` ekle ve risk bölümüne id ver:

```typescript
{/* 3 Ana Kart */}
<div className="grid grid-cols-3 gap-3 mb-4">
  <SummaryCard label="Bugünkü ödev"   value={metrics.todayHomeworkCount} tone="blue"   href="/odevler" />
  <SummaryCard label="Toplam eksik"   value={metrics.totalMissingCount}  tone="orange" href="/odevler?durum=yapilmadi" />
  <SummaryCard label="Aktif risk"     value={metrics.activeRiskCount}    tone="rose"   href="#risk-uyarilari" />
</div>
```

- [ ] **Adım 3:** Risk Uyarıları bölümüne `id` ekle (risk Suspense bloğu):

```typescript
{/* Risk Uyarıları */}
<div id="risk-uyarilari">
  <Suspense fallback={<RiskSkeleton />}>
    <RiskUyarilariWidget />
  </Suspense>
</div>
```

- [ ] **Adım 4:** Commit
```bash
git add app/\(dashboard\)/anasayfa/OgretmenDashboard.tsx
git commit -m "feat: anasayfa özet kartları tıklanabilir (ödevler + eksik + risk)"
```

---

## Task 7: Sınav Ortalama Widget — Karne Özeti

**Files:**
- Modify: `zumre-takip/app/(dashboard)/anasayfa/SinavOrtalamaWidget.tsx`

- [ ] **Adım 1:** Widget'e karne istatistikleri ekle. `return` bloğundan önce hesaplama ekle:

```typescript
// chartData hesaplandıktan sonra, return'dan önce:
const schoolAvg = chartData.length > 0
  ? Math.round(chartData.reduce((s, d) => s + d.ortalama, 0) / chartData.length)
  : 0
const passRate = chartData.length > 0
  ? Math.round(chartData.filter(d => d.ortalama >= 50).length / chartData.length * 100)
  : 0
const bestExam = chartData.length > 0
  ? chartData.reduce((best, d) => d.ortalama > best.ortalama ? d : best)
  : null
```

- [ ] **Adım 2:** `CardContent` içine chart'ın altına özet satırı ekle:

```typescript
<CardContent className="pt-2 pb-4">
  <SinavOrtalamaChart data={chartData} />
  <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-slate-700/50">
    <div className="text-center">
      <p className={`text-sm font-bold ${schoolAvg >= 70 ? 'text-indigo-600 dark:text-indigo-400' : schoolAvg >= 50 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`}>
        {schoolAvg}
      </p>
      <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-0.5">Genel ort.</p>
    </div>
    <div className="text-center">
      <p className={`text-sm font-bold ${passRate >= 80 ? 'text-emerald-600 dark:text-emerald-400' : passRate >= 50 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`}>
        %{passRate}
      </p>
      <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-0.5">Geçme oranı</p>
    </div>
    <div className="text-center overflow-hidden">
      <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 truncate" title={bestExam?.title}>
        {bestExam?.title ?? '—'}
      </p>
      <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-0.5">En başarılı</p>
    </div>
  </div>
</CardContent>
```

- [ ] **Adım 3:** Commit
```bash
git add app/\(dashboard\)/anasayfa/SinavOrtalamaWidget.tsx
git commit -m "feat: sınav ortalama widget'ına karne özeti (genel ort, geçme oranı, en başarılı)"
```

---

## Task 8: Inline Tooltip Bileşeni

**Files:**
- Create: `zumre-takip/components/ui/Tooltip.tsx`
- Modify: `zumre-takip/app/(dashboard)/yoklama/YoklamaClient.tsx` (badge title'ı Tooltip'e yükselt)
- Modify: `zumre-takip/app/(dashboard)/profil/dosyam/page.tsx` (dosya skoru üzerinde açıklama)

- [ ] **Adım 1:** `components/ui/Tooltip.tsx` oluştur:

```typescript
'use client'

import { useState } from 'react'

export default function Tooltip({
  children,
  content,
  position = 'top',
}: {
  children: React.ReactNode
  content: string
  position?: 'top' | 'bottom'
}) {
  const [show, setShow] = useState(false)

  return (
    <span className="relative inline-flex items-center">
      <span
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onFocus={() => setShow(true)}
        onBlur={() => setShow(false)}
        className="cursor-help"
      >
        {children}
      </span>
      {show && (
        <span
          className={`absolute z-50 w-max max-w-64 px-2.5 py-1.5 bg-gray-900 dark:bg-slate-700 text-white text-xs rounded-lg shadow-lg leading-snug pointer-events-none ${
            position === 'top'
              ? 'bottom-full left-1/2 -translate-x-1/2 mb-1.5'
              : 'top-full left-1/2 -translate-x-1/2 mt-1.5'
          }`}
        >
          {content}
          <span
            className={`absolute left-1/2 -translate-x-1/2 border-4 border-transparent ${
              position === 'top'
                ? 'top-full border-t-gray-900 dark:border-t-slate-700'
                : 'bottom-full border-b-gray-900 dark:border-b-slate-700'
            }`}
          />
        </span>
      )}
    </span>
  )
}
```

- [ ] **Adım 2:** Yoklama'daki badge'i `title` attribute'dan gerçek Tooltip'e yükselt.

`YoklamaClient.tsx`'e import ekle:
```typescript
import Tooltip from '@/components/ui/Tooltip'
```

Badge'i şu şekilde güncelle:
```typescript
// title attribute'u kaldır, Tooltip wrapper ekle:
<Tooltip content={`Yıl içi: ${absent} gün devamsız (MEB sınırı 20 gün)`}>
  <span
    className={`shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
      danger ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
      : warn  ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
      :         'bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-slate-400'
    }`}
  >
    {absent}g
  </span>
</Tooltip>
```

- [ ] **Adım 3:** Dosyam sayfasındaki `%{score}` üzerine Tooltip ekle. `profil/dosyam/page.tsx` Server Component, ancak Tooltip Client Component. Bu nedenle sadece HTML `title` attribute kullan (SSR uyumlu):

```typescript
// DosyamPdfButton'ın yanındaki score div'ine title ekle:
<div className="text-right" title="Müfettiş denetimine hazırlık skoru: tüm belge kategorileri tamamlanınca %100 olur">
  <div className="text-2xl font-extrabold">%{status.score}</div>
  <div className="text-xs opacity-75">dosya tamamlanma</div>
</div>
```

Not: Server Component'e Client Tooltip direkt inject edilemez; `title` attribute yeterli burada.

- [ ] **Adım 4:** Ödevler sayfasındaki "kilitlenir" badge'e Tooltip ekle. `odevler/page.tsx` Server Component olduğundan `title` attribute kullan:

```typescript
// pendingCheck bölümündeki gün badge'i (satır ~291-295):
<span
  className={`text-xs font-semibold px-2 py-0.5 rounded-full ${...}`}
  title="Son tarihten 3 gün sonra otomatik kilitlenir, giriş yapılamaz"
>
  {days === 0 ? 'Bugün kilitlenir' : `${days}g kaldı`}
</span>
```

- [ ] **Adım 5:** Commit
```bash
git add components/ui/Tooltip.tsx app/\(dashboard\)/yoklama/YoklamaClient.tsx app/\(dashboard\)/profil/dosyam/page.tsx app/\(dashboard\)/odevler/page.tsx
git commit -m "feat: inline tooltip bileşeni, yoklama devamsızlık ve ödev kilit badge'lerine eklendi"
```

---

## Özet Kontrol

| Task | Kapsanan Gereksinim |
|---|---|
| 1 | Sidebar'dan Öğretmen Dosyası + Zümre Bildirimi kaldırıldı |
| 2 | Zümre Bildirimi → Duyurular sayfasına taşındı |
| 3 | Profil/Dosyam/Öğretmen Dosyası → 3 sekme navigasyonu |
| 4 | Ödev çoğaltma → `?copy` param ile pre-fill |
| 5 | Yoklama → yıl içi devamsızlık badge'i |
| 6 | Anasayfa → özet kartlar tıklanabilir link |
| 7 | Sınav ortalama → karne özeti satırı |
| 8 | Inline Tooltip bileşeni + key noktalara uygulandı |
