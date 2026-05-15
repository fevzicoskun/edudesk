# EduDesk — Architecture Audit

> Last updated: 2026-05-14  
> Stack: Next.js 16.2.4 · React 19 · Supabase (PostgreSQL 17) · Tailwind CSS v4 · TypeScript 5  
> Deploy: Vercel (auto-deploy on `main` push)

---

## 1. Folder Structure

```
zumre-takip/
│
├── app/                              # Next.js 16 App Router root
│   ├── (auth)/                       # Route group — no shared layout applied
│   │   ├── layout.tsx                # Passthrough layout (empty wrapper)
│   │   └── login/
│   │       ├── page.tsx              # Server component — login page shell
│   │       └── LoginForm.tsx         # Client component — useActionState form
│   │
│   ├── (dashboard)/                  # Route group — protected layout
│   │   ├── layout.tsx                # Auth gate + Sidebar render
│   │   ├── anasayfa/                 # Dashboard home
│   │   │   ├── page.tsx              # Server — overview, homeworks, curriculum
│   │   │   ├── loading.tsx           # Skeleton (Suspense fallback)
│   │   │   ├── CalendarWidget.tsx    # Client — mini calendar
│   │   │   ├── MufredatWidget.tsx    # Server — curriculum progress bars
│   │   │   └── SubmissionsPanel.tsx  # Server (Suspense) — stat cards + lists
│   │   │
│   │   ├── odevler/                  # Homework management
│   │   │   ├── page.tsx              # Server — list + filters
│   │   │   ├── loading.tsx
│   │   │   ├── FilterBar.tsx         # Client — URL param filters
│   │   │   └── yeni/
│   │   │       ├── page.tsx          # Server shell
│   │   │       └── HomeworkForm.tsx  # Client — create homework form
│   │   │   └── [id]/
│   │   │       ├── page.tsx          # Server — homework detail
│   │   │       └── StatusBoard.tsx   # Client — student submission board + Excel export
│   │   │
│   │   ├── siniflar/                 # Class management
│   │   │   ├── page.tsx              # Server — class list (role-gated create form)
│   │   │   ├── loading.tsx
│   │   │   ├── SinifArama.tsx        # Client — search + conditional delete button
│   │   │   └── [id]/
│   │   │       ├── page.tsx          # Server — class detail + student list
│   │   │       └── BulkStudentModal.tsx  # Client — bulk add modal
│   │   │       └── ogrenciler/[studentId]/
│   │   │           ├── page.tsx      # Server — student detail + notes
│   │   │           └── CopyVeliLink.tsx  # Client — copy parent link
│   │   │
│   │   ├── yoklama/                  # Attendance
│   │   │   ├── page.tsx              # Server — class/tab switcher
│   │   │   ├── loading.tsx
│   │   │   ├── YoklamaBoard.tsx      # Client — daily attendance grid
│   │   │   ├── YoklamaGecmis.tsx     # Server — history table + absence bars
│   │   │   ├── YoklamaExcelExport.tsx # Client — Excel download button
│   │   │   └── CopySqlButton.tsx     # Client — setup SQL copy helper
│   │   │
│   │   ├── zumre/                    # Department management
│   │   │   ├── page.tsx              # Server — tabbed: meetings / exams / curriculum
│   │   │   ├── loading.tsx
│   │   │   ├── TutanakForm.tsx       # Client — create meeting form
│   │   │   ├── TYMMImportForm.tsx    # Client — TYMM curriculum import
│   │   │   ├── MufredatBoard.tsx     # Client — curriculum topic board
│   │   │   ├── SinavListesi.tsx      # Client — exam list (role-gated delete)
│   │   │   └── SinavCard.tsx         # Client — exam card + grade entry
│   │   │   └── toplanti/[id]/duzenle/
│   │   │       └── page.tsx          # Server — edit meeting form
│   │   │
│   │   ├── notlar/                   # Personal notes
│   │   │   ├── page.tsx
│   │   │   ├── loading.tsx
│   │   │   ├── NotesLayout.tsx       # Client — note sidebar + editor layout
│   │   │   └── NotesEditor.tsx       # Client — contenteditable rich editor
│   │   │
│   │   ├── dosya/                    # Teacher portfolio checklist
│   │   │   ├── page.tsx
│   │   │   ├── loading.tsx
│   │   │   └── DosyaChecklist.tsx    # Client — localStorage-backed checklist
│   │   │
│   │   └── profil/                   # Profile settings
│   │       ├── page.tsx
│   │       ├── ProfilForm.tsx        # Client — name/subject/school update
│   │       └── PasswordForm.tsx      # Client — password change
│   │
│   ├── mufredat/[classId]/
│   │   └── page.tsx                  # Server — print-optimised curriculum report
│   │
│   ├── tutanak/[id]/                 # Public — meeting minutes print view
│   │   ├── page.tsx
│   │   ├── TutanakPrintClient.tsx
│   │   └── PrintButton.tsx
│   │
│   ├── veli/[studentId]/             # Public — parent portal (read-only)
│   │   ├── page.tsx
│   │   └── PrintButton.tsx
│   │
│   ├── yoklama-yazdir/               # Public — attendance print page
│   │   ├── page.tsx
│   │   └── PrintBtn.tsx
│   │
│   ├── actions/                      # Next.js Server Actions ('use server')
│   │   ├── auth.ts                   # login · logout · changePassword
│   │   ├── class.ts                  # createClass* · deleteClass* · addStudent · deleteStudent · addStudentNote
│   │   ├── homework.ts               # createHomework · updateSubmissionStatus · updateAllSubmissionStatuses · deleteHomework
│   │   ├── notes.ts                  # createNote · updateNote · deleteNote
│   │   ├── profile.ts                # updateProfile
│   │   ├── yoklama.ts                # saveAttendance · getAttendanceForDate · getAttendanceHistory
│   │   └── zumre.ts                  # createMeeting* · deleteMeeting* · updateMeeting* · createExam* · deleteExam* · curriculum CRUD · importFromTYMM
│   │                                 # (* = requires zumre_baskani role)
│   │
│   ├── globals.css                   # Tailwind v4 import + @theme tokens + dark mode overrides
│   ├── layout.tsx                    # Root layout — <html lang="tr">, theme script, metadata
│   ├── page.tsx                      # Root redirect → /anasayfa
│   ├── error.tsx                     # Global error boundary (client)
│   └── not-found.tsx                 # 404 page (server)
│
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx               # Client — desktop sidebar + mobile bottom nav + role badge
│   │   └── SidebarCalendar.tsx       # Client — mini calendar widget
│   ├── ui/
│   │   ├── Button.tsx                # Reusable button (variants: primary/secondary/ghost)
│   │   ├── ButtonLink.tsx            # Link styled as button
│   │   ├── buttonStyles.ts           # Tailwind class definitions
│   │   └── cn.ts                     # tailwind-merge utility
│   ├── ConfirmDeleteButton.tsx       # Client — confirm dialog + server action trigger
│   ├── SetupBanner.tsx               # Client — first-run setup hint
│   └── ThemeToggle.tsx               # Client — dark/light toggle (localStorage)
│
├── lib/
│   ├── auth.ts                       # getCurrentUser() · getCurrentProfile() — React cache()
│   ├── types.ts                      # Shared TypeScript interfaces
│   ├── utils.ts                      # getEgitimYili() — academic year string
│   ├── tymm-data.ts                  # Turkish national curriculum topics (TYMM)
│   └── supabase/
│       ├── server.ts                 # createServerClient() — cookie-based SSR client
│       └── client.ts                 # createBrowserClient() — browser client
│
├── supabase/
│   ├── schema.sql                    # Full DB schema (tables, indexes, triggers, initial RLS)
│   └── rls_update.sql                # Role-based RLS migration (applied 2026-05-14)
│
├── public/                           # Static assets
├── proxy.ts                          # Next.js 16 middleware (auth guard + session refresh)
├── middleware.ts                     # Empty — Next.js 16 uses proxy.ts, not middleware.ts
├── next.config.ts                    # Minimal config (no custom options)
├── tsconfig.json                     # Strict TS, path alias @/* → ./
├── postcss.config.mjs                # @tailwindcss/postcss
├── .env.example                      # Template for required env vars
└── package.json
```

---

## 2. Next.js 16 Middleware — `proxy.ts`

> **Breaking change in Next.js 16:** The middleware entry point was renamed from `middleware.ts` to `proxy.ts`. The exported function must be named `proxy` (not `middleware`). Both files cannot coexist — the build fails if `middleware.ts` exports anything meaningful alongside `proxy.ts`.

```typescript
// proxy.ts
const PUBLIC_PATHS = ['/login', '/veli', '/tutanak', '/yoklama-yazdir']

export async function proxy(request: NextRequest) {
  // 1. Refresh Supabase session cookies (critical for SSR auth)
  // 2. If no user AND not a public path → redirect to /login
  // 3. If user AND on /login → redirect to /anasayfa
  // 4. Otherwise pass through
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
```

**Public paths** (bypass auth check):

| Path | Purpose |
|---|---|
| `/login` | Auth entry point |
| `/veli/*` | Parent portal — read-only, anon DB access |
| `/tutanak/*` | Meeting minutes print — public view |
| `/yoklama-yazdir` | Attendance print — public view |

**Session refresh:** The middleware instantiates a Supabase client with cookie read/write access on every request. This ensures JWT tokens are refreshed before server components run, preventing stale session issues.

---

## 3. Auth Flow

```
Browser Request
     │
     ▼
proxy.ts (Next.js Proxy/Middleware)
     │
     ├─ createServerClient() with request.cookies
     ├─ supabase.auth.getUser()          ← validates JWT, refreshes if needed
     ├─ is public path? ──────────────── YES → pass through
     │
     ├─ no user + protected path ──────► redirect /login
     │
     └─ user + /login ────────────────► redirect /anasayfa
          │
          ▼
     (dashboard)/layout.tsx
          │
          ├─ getCurrentUser()             ← React cache() — deduped per request
          ├─ no user? ─────────────────► redirect /login (defence-in-depth)
          │
          └─ getCurrentProfile()         ← fetches profiles row (role, subject, etc.)
               │
               └─ renders Sidebar + <main>
```

### Login sequence

```
LoginForm (client, useActionState)
  │
  └─ login() server action
       │
       ├─ supabase.auth.signInWithPassword({ email, password })
       ├─ error → return { error: 'E-posta veya şifre hatalı.' }
       └─ success → redirect('/')  →  proxy.ts catches → redirect /anasayfa
```

### Logout sequence

```
Sidebar logout <form action={logout}>
  │
  └─ logout() server action
       │
       ├─ supabase.auth.signOut()
       └─ redirect('/login')
```

### Password change

```
PasswordForm (client)
  │
  └─ changePassword() server action
       │
       ├─ getUser() — verify session
       ├─ validate: length ≥ 6, passwords match
       └─ supabase.auth.updateUser({ password })
```

### Profile auto-creation

When a new user signs up in Supabase Auth, a `SECURITY DEFINER` database trigger fires:

```sql
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

`handle_new_user()` inserts a row into `public.profiles` with `role = 'ogretmen'` by default. Role elevation to `zumre_baskani` is done manually in Supabase Table Editor.

---

## 4. Supabase RLS Policies

### Helper function (applied 2026-05-14)

```sql
CREATE OR REPLACE FUNCTION is_zumre_baskani()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS(
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'zumre_baskani'
  )
$$;
```

`STABLE` + `SECURITY DEFINER` means it runs with owner privileges once per query, bypassing the caller's RLS context safely.

### Policy matrix

| Table | Operation | Who |
|---|---|---|
| `profiles` | SELECT | Any authenticated |
| `profiles` | UPDATE | Own row only (`auth.uid() = id`) |
| `classes` | SELECT | Any authenticated |
| `classes` | INSERT / UPDATE / DELETE | `is_zumre_baskani()` |
| `students` | ALL | Any authenticated |
| `teacher_classes` | ALL | Any authenticated |
| `homeworks` | SELECT | Any authenticated |
| `homeworks` | INSERT | Own (`teacher_id = auth.uid()`) |
| `homeworks` | UPDATE / DELETE | Own (`teacher_id = auth.uid()`) |
| `homework_submissions` | SELECT | Any authenticated + anon |
| `homework_submissions` | INSERT | Any authenticated (trigger-driven) |
| `homework_submissions` | UPDATE | Homework owner OR `is_zumre_baskani()` |
| `zumre_meetings` | SELECT | Any authenticated |
| `zumre_meetings` | INSERT | `is_zumre_baskani()` |
| `zumre_meetings` | UPDATE / DELETE | Creator OR `is_zumre_baskani()` |
| `common_exams` | SELECT | Any authenticated |
| `common_exams` | INSERT | `is_zumre_baskani()` |
| `common_exams` | UPDATE / DELETE | Creator OR `is_zumre_baskani()` |
| `curriculum_progress` | SELECT | Own rows OR `is_zumre_baskani()` |
| `curriculum_progress` | INSERT | Own (`teacher_id = auth.uid()`) |
| `curriculum_progress` | UPDATE / DELETE | Own OR `is_zumre_baskani()` |
| `attendance` | ALL | Own (`teacher_id = auth.uid()`) |
| `attendance` | SELECT | anon (public read for parent portal) |
| `student_notes` | SELECT | Any authenticated |
| `student_notes` | INSERT / DELETE | Own (`teacher_id = auth.uid()`) |
| `user_notes` | ALL | Own (`user_id = auth.uid()`) |

### Database triggers

```
on_auth_user_created  →  handle_new_user()
  After INSERT on auth.users → inserts into profiles (role='ogretmen')

on_homework_created  →  create_submissions_for_homework()
  After INSERT on homeworks → inserts homework_submissions for all students in class
  (homework_id, student_id, school_id) — school_id propagated via NEW.school_id

profiles_role_lock  →  prevent_role_escalation()
  Before UPDATE on profiles → blocks role changes except onboarding-time baskan assignment
```

---

## 5. Package Dependencies

### Runtime (`dependencies`)

| Package | Version | Purpose |
|---|---|---|
| `next` | 16.2.4 | App Router framework |
| `react` | 19.2.4 | UI library |
| `react-dom` | 19.2.4 | DOM renderer |
| `@supabase/ssr` | ^0.10.2 | SSR-compatible Supabase client (cookie handling) |
| `@supabase/supabase-js` | ^2.105.3 | Supabase JS SDK |
| `date-fns` | ^4.1.0 | Date formatting / manipulation (tr locale) |
| `tailwind-merge` | ^3.5.0 | Class name deduplication utility |
| `xlsx` | ^0.18.5 | SheetJS — Excel file generation (client-side) |

### Dev (`devDependencies`)

| Package | Version | Purpose |
|---|---|---|
| `tailwindcss` | ^4 | CSS utility framework |
| `@tailwindcss/postcss` | ^4 | Tailwind v4 PostCSS integration |
| `typescript` | ^5 | Static typing |
| `@types/node` | ^20 | Node.js type definitions |
| `@types/react` | ^19 | React type definitions |
| `@types/react-dom` | ^19 | React DOM type definitions |

> **No test framework** is installed. `xlsx` has no `@types/xlsx` because it ships its own TypeScript declarations.

---

## 6. App Router Structure

### Route groups

| Group | Path prefix | Shared layout | Auth required |
|---|---|---|---|
| `(auth)` | `/login` | Passthrough | No |
| `(dashboard)` | `/anasayfa`, `/odevler`, `/siniflar`, `/yoklama`, `/zumre`, `/notlar`, `/dosya`, `/profil` | Sidebar + main wrapper | Yes |
| *(root)* | `/mufredat/[classId]`, `/tutanak/[id]`, `/veli/[studentId]`, `/yoklama-yazdir` | None | Mixed |

### Rendering modes

| Route | Mode | `revalidate` |
|---|---|---|
| `/anasayfa` | Dynamic server | 60 s |
| `/odevler` | Dynamic server | 30 s |
| `/odevler/[id]` | Dynamic server | `0` (always fresh) |
| `/siniflar` | Dynamic server | default |
| `/yoklama` | Dynamic server | `0` |
| `/zumre` | Dynamic server | 60 s |
| `/notlar` | Dynamic server | default |
| `/login` | Static | — |
| `/veli/[studentId]` | Dynamic server | default |
| `/tutanak/[id]` | Dynamic server | default |

### Loading states

Every `(dashboard)` route has a `loading.tsx` skeleton that renders immediately via React Suspense while the server fetches data. Skeletons match the visual structure of the real page (card shapes, correct grid layout).

---

## 7. Dashboard Architecture

```
(dashboard)/layout.tsx          ← Server component
  │
  ├─ getCurrentUser()            ← React cache — memoised per request
  ├─ getCurrentProfile()         ← React cache — memoised per request
  ├─ <Sidebar profile email />   ← Client component (needs usePathname)
  └─ <main>{children}</main>
        │
        ├─ <Suspense fallback={<loading.tsx>}>
        │      page.tsx content (server)
        └─ Client components (interactive islands)
```

### Data flow pattern

All data fetching happens in **server page components** using the Supabase server client. Interactive mutations go through **server actions** (`app/actions/*.ts`). Client components receive data as props and call server actions for mutations.

```
page.tsx (server)
  │─ supabase.from('table').select(...)
  │─ passes data as props ──► ClientComponent.tsx
                                    │─ user interaction
                                    └─ serverAction()  ──► supabase mutation
                                                            revalidatePath()
```

### Suspense streaming

`/anasayfa` uses streaming with a `<Suspense>` boundary around `<SubmissionsPanel>` — a slow query (submission stats across all homeworks) is deferred while the rest of the page renders immediately.

---

## 8. `lib/supabase` Structure

### `lib/supabase/server.ts` — SSR client

```typescript
export async function createClient() {
  const cookieStore = await cookies()   // Next.js cookies() — request-scoped
  return createServerClient(URL, KEY, {
    cookies: {
      getAll()        { return cookieStore.getAll() },
      setAll(list)    { list.forEach(({ name, value, options }) =>
                          cookieStore.set(name, value, options)) }
    }
  })
}
```

Used in: Server components, Server actions, `proxy.ts` middleware.

The `setAll` is wrapped in a try/catch in server components (cookie writes fail silently — only proxy/middleware can write response cookies). This is the standard Supabase SSR pattern.

### `lib/supabase/client.ts` — Browser client

```typescript
export function createClient() {
  return createBrowserClient(URL, KEY)
}
```

Used in: Client components that need real-time or direct Supabase access (currently `yoklama.ts` action calls are server-side, so this is rarely used directly).

### `lib/auth.ts` — Memoised auth helpers

```typescript
export const getCurrentUser    = cache(async () => { ... })
export const getCurrentProfile = cache(async () => { ... })
```

`React.cache()` deduplicates calls within a single server render pass. Both the layout and individual page components can call these independently with zero extra DB round-trips per request.

---

## 9. Role System

### Roles

| Value | Turkish label | Stored in |
|---|---|---|
| `ogretmen` | Öğretmen | `profiles.role` |
| `zumre_baskani` | Zümre Başkanı | `profiles.role` |

Default role on signup: `ogretmen`. Elevation is manual (Supabase Dashboard).

### Enforcement layers

**Layer 1 — Database (RLS)**  
`is_zumre_baskani()` PostgreSQL function checks `profiles.role` for `auth.uid()`. Applied at the DB query level — impossible to bypass from the application.

**Layer 2 — Server actions (`requireBaskan()`)**  
```typescript
async function requireBaskan() {
  const profile = await getCurrentProfile()
  if (profile?.role !== 'zumre_baskani') throw new Error('...')
}
```
Called at the top of privileged actions: `createMeeting`, `deleteMeeting`, `updateMeeting`, `createExam`, `deleteExam`, `createClass`, `deleteClass`.

**Layer 3 — UI (conditional rendering)**  
```typescript
const isBaskan = profile?.role === 'zumre_baskani'
// In JSX:
{isBaskan && <CreateForm />}
{isBaskan && <DeleteButton />}
```
Applied in: `zumre/page.tsx`, `siniflar/page.tsx`, `SinifArama.tsx`, `SinavCard.tsx`, `SinavListesi.tsx`, `Sidebar.tsx`.

### Role-gated features

| Feature | ogretmen | zumre_baskani |
|---|---|---|
| View all homeworks | ❌ own only | ✅ |
| Create/delete class | ❌ | ✅ |
| Create zümre meeting | ❌ | ✅ |
| Edit/delete meeting | ❌ | ✅ |
| Create/delete common exam | ❌ | ✅ |
| View all curriculum progress | ❌ own only | ✅ |
| Update any submission | ❌ own homework | ✅ |
| Sidebar "Başkan" badge | ❌ | ✅ |

---

## 10. Server / Client Component Strategy

### Decision rule

```
Default: Server Component
  → needs interactivity (onClick, onChange, useState, useEffect)?  → 'use client'
  → needs browser API (localStorage, window)?                       → 'use client'
  → needs Next.js hooks (usePathname, useRouter)?                   → 'use client'
```

### Server components (no directive)

- All `page.tsx` files in `(dashboard)/`
- `YoklamaGecmis.tsx`, `MufredatWidget.tsx`, `SubmissionsPanel.tsx`
- `lib/auth.ts`, all `app/actions/*.ts`
- `app/layout.tsx`, `app/error.tsx` (error.tsx must be `'use client'`)

### Client components (`'use client'`)

| Component | Why client |
|---|---|
| `Sidebar.tsx` | `usePathname()` for active link |
| `LoginForm.tsx` | `useActionState()`, form state |
| `StatusBoard.tsx` | `useState`, `useTransition`, Excel export (`xlsx.writeFile`) |
| `YoklamaBoard.tsx` | `useState`, `useEffect` (date change → fetch) |
| `YoklamaExcelExport.tsx` | `xlsx.writeFile` (browser API) |
| `SinavCard.tsx` | Complex local state (grade entry, per-student mode) |
| `SinavListesi.tsx` | Optimistic delete state |
| `SinifArama.tsx` | Search filter `useState` |
| `ThemeToggle.tsx` | `localStorage`, `classList` |
| `ConfirmDeleteButton.tsx` | `window.confirm`, `useTransition` |
| `DosyaChecklist.tsx` | `localStorage`, `useState` |
| `NotesEditor.tsx` / `NotesLayout.tsx` | `contenteditable`, autosave |
| `TutanakForm.tsx`, `TYMMImportForm.tsx` | Form state, `useActionState` |
| `CalendarWidget.tsx` | Date state |
| `error.tsx` | Required by Next.js (`useEffect` for logging) |

### Islands architecture

Each page is predominantly server-rendered. Client components are "islands" mounted only where interaction is needed, minimising JavaScript sent to the browser.

```
page.tsx (server — zero JS)
  ├─ Static markup (server)
  ├─ <StatusBoard />        ← client island (submission board)
  └─ <FilterBar />          ← client island (URL filter controls)
```

---

## 11. Security Notes

### Strengths

**Double-layer role enforcement**  
Every privileged mutation is blocked at both the server action layer (`requireBaskan()` throws before any DB call) and the database layer (RLS policy rejects the query even if the action guard is bypassed). An attacker who crafts a raw API call to Supabase still hits RLS.

**`auth.getUser()` over `auth.getSession()`**  
All auth checks use `supabase.auth.getUser()` which validates the JWT with the Supabase auth server, not just reading the local session cookie. This prevents token forgery attacks.

**`SECURITY DEFINER` on `is_zumre_baskani()`**  
The function runs under the role of the function owner (not the calling user), preventing privilege-escalation via manipulated RLS context.

**No API routes**  
The application uses only Server Actions and direct Supabase client calls. There are no custom `/api/*` routes that could be targeted independently.

**Trigger-based submission creation**  
`homework_submissions` rows are created by a `SECURITY DEFINER` trigger when a homework is inserted — not by the application. This prevents an authenticated user from manually inserting submissions for homeworks they don't own.

**Parent portal isolation**  
`/veli/[studentId]` reads only from `attendance` (which has `FOR SELECT TO anon USING (true)`) and `students`. No write access is possible from anon context.

### Known gaps / recommendations

| Gap | Risk | Recommendation |
|---|---|---|
| No email verification | Any email can sign up (signup is closed by UX message but not enforced) | Enable Supabase "Confirm email" setting, or disable public signups and use invite-only |
| `students` table has `FOR ALL TO authenticated USING (true)` | Any teacher can add/delete students in any class | Restrict to class owner or `is_zumre_baskani()` if strict class ownership is required |
| `teacher_classes` has no write restriction | Any teacher can assign themselves to any class | Restrict INSERT to `is_zumre_baskani()` if teacher-class assignments should be controlled |
| No rate limiting on login | Brute-force possible | Enable Supabase Auth rate limiting or add Cloudflare Turnstile |
| `homework_submissions INSERT` is open to any authenticated user | Teacher could manually insert submissions for other teachers' homeworks | Restrict via RLS to homework owner or trigger-only (revoke direct INSERT from authenticated) |
| `changePassword` doesn't invalidate other sessions | Compromised session stays valid after password change | Call `supabase.auth.admin.signOut(userId, { scope: 'others' })` after password update |
| Dark mode theme script uses `dangerouslySetInnerHTML` | Low risk — static string, no user input | Acceptable; move to a separate `.js` file if CSP headers are added |
| No CSP headers configured | XSS escalation risk if inline scripts are used | Add `Content-Security-Policy` headers in `next.config.ts` via `headers()` |
| `xlsx.writeFile` runs in browser only | No server-side Excel generation possible | Acceptable for current use case; note for future server-export requirements |

---

## 12. Security Fixes Log

Geriye dönük referans: hangi güvenlik açığı ne zaman kapandı.

| # | Tarih | Açıklama | Dosyalar |
|---|-------|----------|----------|
| 1–16 | 2026-05-15 | Phase 3 güvenlik turu — school_id NOT NULL, RLS hardening, token revocation, rate limiting | supabase/migrations/20260515_* |
| 17 | 2026-05-15 | **homework trigger school_id propagation** — `create_submissions_for_homework()` fonksiyonu `school_id` geçirmiyordu. Phase 3 NOT NULL migration'ı sonrası her yeni ödev oluşturmada `null value in column "school_id"` hatası veriyordu. `NEW.school_id`'yi de aktaracak şekilde düzeltildi. | `supabase/migrations/20260515_fix_homework_submissions_trigger.sql`, `supabase/schema.sql` |

---

## Summary

EduDesk is a clean, well-structured Next.js 16 application that correctly applies the App Router paradigm: server components for data, client components only for interactivity, and server actions for all mutations. The security model is genuinely two-layered (RLS + action guards). The main area for improvement is closing the remaining open-write policies on `students` and `homework_submissions INSERT`, and enabling invite-only or email-verified signup to prevent unauthorised account creation.
