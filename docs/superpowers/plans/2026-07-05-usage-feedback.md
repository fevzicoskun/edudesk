# Kullanım Metrikleri + Geri Bildirim İmplementasyon Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sayfa-görünümü bazlı kullanım metrikleri (`usage_daily` + client beacon) ve mevcut feedback akışına kalıcı DB kaydı; her ikisi /platform süper-admin panelinde görünür.

**Architecture:** Client beacon → `/api/usage` → `increment_usage` SECURITY DEFINER RPC → `usage_daily` günlük sayaç tablosu. Feedback: mevcut `sendFeedback` action'ı DB-öncelikli hale gelir (mail best-effort'a düşer). /platform iki `security_invoker` view + service client ile okur.

**Tech Stack:** Next.js App Router (özel sürüm — middleware dosyası `proxy.ts`), Supabase (RLS + plpgsql), Zod, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-07-05-usage-feedback-design.md`

## Global Constraints

- Supabase project ID: `agijvfrcudpzsofgfogu`
- Her migration sonrası DB tipleri regenerate edilir: `npx supabase gen types typescript --project-id agijvfrcudpzsofgfogu > src/infrastructure/supabase/database.types.ts` (yoksa tsc kırılır). MCP aracı `mcp__plugin_supabase_supabase__generate_typescript_types` de kullanılabilir.
- Migration uygulama: MCP `mcp__plugin_supabase_supabase__apply_migration` (dosya içeriğiyle aynı SQL) — dosya `supabase/migrations/`'a da yazılır.
- SECURITY DEFINER fonksiyonlarda `set search_path = public` zorunlu (advisor).
- SECURITY DEFINER fonksiyonlardan `authenticated` EXECUTE'u ASLA çekme (memory: production kilitler); `anon`/`public`'ten çekilir.
- `usage_daily` ve `feedback` tablolarına authenticated için SELECT policy YOK → bu tablolara `.insert().select()` ÇAĞRILMAZ.
- Soluk metin tokenı: `text-gray-500 dark:text-slate-400` (WCAG AA); `text-gray-400` kullanma. /platform sayfası istisna: kendi koyu (slate-900) stilinde `text-slate-400/500` kullanıyor, ona uy.
- Tarihler TR günü ile: `(now() at time zone 'Europe/Istanbul')::date`.
- Testler: `npx vitest run tests/vitest/unit/...` (unit), `npx vitest run tests/vitest/integration/...` (gerçek Supabase, `.env.local` gerekir). E2e: `npx playwright test tests/playwright/e2e/feedback.spec.ts`.
- Her task sonunda commit + `git push origin main` (kullanıcı tercihi: onay sorma).

---

### Task 1: Migration — tablolar, RPC, view'lar + RLS integration testleri

**Files:**
- Create: `supabase/migrations/20260705150000_usage_feedback.sql`
- Modify: `src/infrastructure/supabase/database.types.ts` (regenerate)
- Test: `tests/vitest/integration/rls/usage-feedback-rls.test.ts`

**Interfaces:**
- Produces: `usage_daily` tablosu, `feedback` tablosu, `increment_usage(p_feature text)` RPC (authenticated EXECUTE), `usage_summary` ve `usage_active_users` view'ları (yalnızca service-role okuyabilir).
- Consumes: mevcut `current_school_id()` RLS helper'ı, `profiles(id, school_id, role)`, `schools(id, name)`.

- [ ] **Step 1: Migration dosyasını yaz**

`supabase/migrations/20260705150000_usage_feedback.sql`:

```sql
-- Kullanım metrikleri + geri bildirim kalıcı kaydı
-- Spec: docs/superpowers/specs/2026-07-05-usage-feedback-design.md

-- ── usage_daily: günlük sayaç (kullanıcı × özellik × gün) ─────────────
create table public.usage_daily (
  day        date        not null,
  school_id  uuid        not null references public.schools(id),
  user_id    uuid        not null,
  role       text        not null,
  feature    text        not null,
  count      integer     not null default 1,
  primary key (day, school_id, user_id, feature)
);

-- RLS açık, policy YOK: authenticated hiçbir şey yapamaz; yazım RPC ile,
-- okuma yalnızca service-role (/platform).
alter table public.usage_daily enable row level security;

-- ── increment_usage: kimliği auth.uid()'den türeten atomik upsert ─────
create or replace function public.increment_usage(p_feature text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_school_id uuid;
  v_role      text;
  v_day       date := (now() at time zone 'Europe/Istanbul')::date;
begin
  -- Metrik yazımı hiçbir akışı kırmamalı: geçersiz girişte sessizce çık.
  if p_feature is null or length(p_feature) > 40 then
    return;
  end if;

  select school_id, role::text into v_school_id, v_role
  from public.profiles
  where id = auth.uid();

  if v_school_id is null then
    return;
  end if;

  insert into public.usage_daily (day, school_id, user_id, role, feature)
  values (v_day, v_school_id, auth.uid(), v_role, p_feature)
  on conflict (day, school_id, user_id, feature)
  do update set count = usage_daily.count + 1;
end;
$$;

revoke execute on function public.increment_usage(text) from public, anon;
grant  execute on function public.increment_usage(text) to authenticated;

-- ── feedback: kalıcı geri bildirim kaydı ──────────────────────────────
create table public.feedback (
  id         uuid        primary key default gen_random_uuid(),
  school_id  uuid        not null references public.schools(id),
  user_id    uuid        not null,
  role       text        not null,
  page_path  text        not null,
  category   text        not null check (category in ('oneri', 'istek', 'sikayet')),
  message    text        not null check (char_length(message) between 3 and 2000),
  created_at timestamptz not null default now()
);

alter table public.feedback enable row level security;

-- Yalnız kendi adına, kendi okuluna INSERT. SELECT/UPDATE/DELETE policy yok.
create policy "feedback_insert" on public.feedback
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and school_id = (select current_school_id())
  );

-- ── /platform aggregate view'ları ─────────────────────────────────────
-- security_invoker: authenticated çağırırsa tablo policy'si (yok) uygulanır
-- → boş döner; service-role tam görür.
create view public.usage_summary
  with (security_invoker = true) as
select
  u.school_id,
  s.name as school_name,
  u.feature,
  count(distinct u.user_id) filter (where u.day >= current_date - 7)              as users_7d,
  coalesce(sum(u.count)     filter (where u.day >= current_date - 7),  0)::bigint as views_7d,
  count(distinct u.user_id)                                                       as users_30d,
  coalesce(sum(u.count), 0)::bigint                                               as views_30d
from public.usage_daily u
join public.schools s on s.id = u.school_id
where u.day >= current_date - 30
group by u.school_id, s.name, u.feature;

create view public.usage_active_users
  with (security_invoker = true) as
select
  u.school_id,
  s.name as school_name,
  count(distinct u.user_id) filter (where u.day >= current_date - 7) as users_7d,
  count(distinct u.user_id)                                          as users_30d
from public.usage_daily u
join public.schools s on s.id = u.school_id
where u.day >= current_date - 30
group by u.school_id, s.name;
```

- [ ] **Step 2: Migration'ı uygula**

MCP: `mcp__plugin_supabase_supabase__apply_migration` — project_id `agijvfrcudpzsofgfogu`, name `usage_feedback`, query = yukarıdaki SQL'in tamamı.
Expected: başarı; `mcp__plugin_supabase_supabase__list_tables` çıktısında `usage_daily` ve `feedback` görünür.

- [ ] **Step 3: DB tiplerini regenerate et**

Run: `npx supabase gen types typescript --project-id agijvfrcudpzsofgfogu > src/infrastructure/supabase/database.types.ts`
(çalışmazsa MCP `generate_typescript_types` çıktısını dosyaya yaz)
Sonra: `npx tsc --noEmit`
Expected: tip hatası yok; `database.types.ts` içinde `usage_daily`, `feedback`, `usage_summary`, `usage_active_users`, `increment_usage` görünür.

- [ ] **Step 4: RLS integration testini yaz**

`tests/vitest/integration/rls/usage-feedback-rls.test.ts`:

```ts
/**
 * usage_daily + feedback RLS testleri.
 * DİKKAT: Bu tablolarda SELECT policy yok — assertInsertAllowed (insert().select())
 * KULLANILAMAZ; düz insert + serviceDb doğrulaması yapılır.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import {
  serviceDb,
  createUserClient,
  createTestSchool,
  createTestUser,
  signInTestUser,
  cleanupTestData,
  type TestSchool,
  type TestUser,
} from '../../setup/db'
import { assertInsertBlocked, assertCannotRead } from './rls-assert'

let school:   TestSchool
let school2:  TestSchool
let ogretmen: TestUser
let token:    string

beforeAll(async () => {
  school  = await createTestSchool('_USAGE')
  school2 = await createTestSchool('_USAGE2')
  ogretmen = await createTestUser({ role: 'ogretmen', schoolId: school.id })
  token = await signInTestUser(ogretmen.email, ogretmen.password)
})

afterAll(async () => {
  await serviceDb.from('usage_daily').delete().eq('school_id', school.id)
  await serviceDb.from('feedback').delete().eq('school_id', school.id)
  await cleanupTestData()
})

describe('increment_usage RPC', () => {
  it('aynı gün iki çağrıda count=2 olur', async () => {
    const client = createUserClient(token)
    const { error: e1 } = await client.rpc('increment_usage', { p_feature: 'yoklama' })
    expect(e1).toBeNull()
    const { error: e2 } = await client.rpc('increment_usage', { p_feature: 'yoklama' })
    expect(e2).toBeNull()

    const { data } = await serviceDb
      .from('usage_daily')
      .select('count, role, school_id')
      .eq('user_id', ogretmen.id)
      .eq('feature', 'yoklama')
      .single()
    expect(data?.count).toBe(2)
    expect(data?.role).toBe('ogretmen')
    expect(data?.school_id).toBe(school.id)
  })

  it('farklı feature ayrı satır açar', async () => {
    const client = createUserClient(token)
    await client.rpc('increment_usage', { p_feature: 'odevler' })
    const { data } = await serviceDb
      .from('usage_daily')
      .select('feature')
      .eq('user_id', ogretmen.id)
    expect(data?.map(r => r.feature).sort()).toEqual(['odevler', 'yoklama'])
  })

  it('usage_daily tablosuna doğrudan INSERT engellenir', async () => {
    const client = createUserClient(token)
    await assertInsertBlocked(client, 'usage_daily', {
      day: '2026-07-05', school_id: school.id, user_id: ogretmen.id,
      role: 'ogretmen', feature: 'hack',
    })
  })

  it('usage_daily doğrudan okunamaz (0 satır)', async () => {
    const client = createUserClient(token)
    const { data, error } = await client.from('usage_daily').select('*')
    expect(error).toBeNull()
    expect(data ?? []).toHaveLength(0)
  })
})

describe('feedback INSERT policy', () => {
  it('kendi adına, kendi okuluna INSERT edebilir (select olmadan)', async () => {
    const client = createUserClient(token)
    const { error } = await client.from('feedback').insert({
      school_id: school.id, user_id: ogretmen.id, role: 'ogretmen',
      page_path: '/yoklama', category: 'oneri', message: 'RLS testi mesajı',
    })
    expect(error).toBeNull()

    const { data } = await serviceDb
      .from('feedback').select('id').eq('user_id', ogretmen.id)
    expect(data).toHaveLength(1)
  })

  it('başka kullanıcı adına INSERT engellenir', async () => {
    const client = createUserClient(token)
    await assertInsertBlocked(client, 'feedback', {
      school_id: school.id, user_id: '00000000-0000-0000-0000-000000000001',
      role: 'ogretmen', page_path: '/', category: 'oneri', message: 'sahte kayıt',
    })
  })

  it('başka okul adına INSERT engellenir', async () => {
    const client = createUserClient(token)
    await assertInsertBlocked(client, 'feedback', {
      school_id: school2.id, user_id: ogretmen.id,
      role: 'ogretmen', page_path: '/', category: 'oneri', message: 'yanlış okul',
    })
  })

  it('kendi kaydını bile okuyamaz (SELECT policy yok)', async () => {
    const client = createUserClient(token)
    const { data, error } = await client.from('feedback').select('*')
    expect(error).toBeNull()
    expect(data ?? []).toHaveLength(0)
  })

  it('view\'lar authenticated için boş döner', async () => {
    const client = createUserClient(token)
    const { data } = await client.from('usage_summary').select('*')
    expect(data ?? []).toHaveLength(0)
  })
})
```

Not: `tests/vitest/setup/db.ts`'teki gerçek helper imzaları farklıysa (örn. `createUserClient(token)` yerine başka form), mevcut `rls-policies.test.ts`'in kullandığı forma uyarla — davranış assert'leri aynı kalır.

- [ ] **Step 5: Integration testleri çalıştır**

Run: `npx vitest run tests/vitest/integration/rls/usage-feedback-rls.test.ts`
Expected: tümü PASS.

- [ ] **Step 6: Commit + push**

```bash
git add supabase/migrations/20260705150000_usage_feedback.sql src/infrastructure/supabase/database.types.ts tests/vitest/integration/rls/usage-feedback-rls.test.ts
git commit -m "feat: usage_daily + feedback tablolari, increment_usage RPC, platform view'lari"
git push origin main
```

---

### Task 2: Route → feature eşlemesi (`featureFromPath`)

**Files:**
- Create: `src/shared/usage/featureMap.ts`
- Test: `tests/vitest/unit/shared/featureMap.test.ts`

**Interfaces:**
- Produces: `FEATURES: readonly string[]` (izlenen özellik adları), `featureFromPath(pathname: string): Feature | null`, `type Feature`.
- Consumes: — (saf fonksiyon, bağımlılık yok).

- [ ] **Step 1: Failing test yaz**

`tests/vitest/unit/shared/featureMap.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { featureFromPath, FEATURES } from '@/src/shared/usage/featureMap'

describe('featureFromPath', () => {
  it('bilinen kök route\'u eşler', () => {
    expect(featureFromPath('/yoklama')).toBe('yoklama')
    expect(featureFromPath('/anasayfa')).toBe('anasayfa')
  })

  it('alt path\'i kök özelliğe eşler', () => {
    expect(featureFromPath('/yoklama/5a-sinifi')).toBe('yoklama')
    expect(featureFromPath('/siniflar/123/ogrenciler')).toBe('siniflar')
  })

  it('bilinmeyen route\'ta null döner', () => {
    expect(featureFromPath('/platform')).toBeNull()
    expect(featureFromPath('/login')).toBeNull()
    expect(featureFromPath('/')).toBeNull()
  })

  it('FEATURES 40 karakteri aşan ad içermez (RPC guard sınırı)', () => {
    for (const f of FEATURES) expect(f.length).toBeLessThanOrEqual(40)
  })
})
```

- [ ] **Step 2: Testin FAIL ettiğini doğrula**

Run: `npx vitest run tests/vitest/unit/shared/featureMap.test.ts`
Expected: FAIL — "Cannot find module '@/src/shared/usage/featureMap'"

- [ ] **Step 3: Implementasyonu yaz**

`src/shared/usage/featureMap.ts`:

```ts
// Kullanım metriği izlenen dashboard modülleri.
// app/(dashboard)/ altındaki kök segment'lerle birebir; /platform bilinçli olarak dışarıda.
export const FEATURES = [
  'anasayfa', 'yoklama', 'odevler', 'takvim', 'ders-programi',
  'randevular', 'rapor', 'siniflar', 'kullanicilar', 'nobet',
  'yonetim', 'ayarlar', 'profil',
] as const

export type Feature = (typeof FEATURES)[number]

export function featureFromPath(pathname: string): Feature | null {
  const seg = pathname.split('/')[1] ?? ''
  return (FEATURES as readonly string[]).includes(seg) ? (seg as Feature) : null
}
```

- [ ] **Step 4: Testin PASS ettiğini doğrula**

Run: `npx vitest run tests/vitest/unit/shared/featureMap.test.ts`
Expected: PASS (4 test).

- [ ] **Step 5: Commit + push**

```bash
git add src/shared/usage/featureMap.ts tests/vitest/unit/shared/featureMap.test.ts
git commit -m "feat: route->feature eslemesi (featureFromPath)"
git push origin main
```

---

### Task 3: `/api/usage` endpoint'i + proxy rate-limit ayarı

**Files:**
- Create: `app/api/usage/route.ts`
- Modify: `src/infrastructure/http/routeAccess.ts` (RATE_LIMIT_EXEMPT_API_PATHS'e `/api/usage`)
- Modify: `proxy.ts` (usage'a özel limiter)
- Test: `tests/vitest/unit/http/routeAccess.test.ts` (varsa mevcut dosyaya ekle, yoksa oluştur)

**Interfaces:**
- Consumes: Task 2'den `FEATURES`; Task 1'den `increment_usage` RPC; `createClient()` (`@/src/infrastructure/supabase/server`).
- Produces: `POST /api/usage` — body `{ feature: string }`, her durumda 204 döner (metrik yazımı hiçbir akışı kırmaz).

- [ ] **Step 1: routeAccess değişikliği + testi**

`src/infrastructure/http/routeAccess.ts` içinde `RATE_LIMIT_EXEMPT_API_PATHS`'e ekle (yorumuyla):

```ts
export const RATE_LIMIT_EXEMPT_API_PATHS = new Set([
  '/api/health',
  '/api/ready',
  '/api/live',
  '/api/inngest',
  '/api/usage',  // beacon — okul IP'sinden yoğun gelir; genel 30/dk api bucket'ını boğmasın (kendi limiter'ı var)
])
```

`tests/vitest/unit/http/routeAccess.test.ts` — dosya varsa şu testi ekle, yoksa oluştur:

```ts
import { describe, it, expect } from 'vitest'
import { RATE_LIMIT_EXEMPT_API_PATHS, isPublicPath } from '@/src/infrastructure/http/routeAccess'

describe('usage endpoint erişim kuralları', () => {
  it('/api/usage genel api rate-limit bucket\'ından muaf', () => {
    expect(RATE_LIMIT_EXEMPT_API_PATHS.has('/api/usage')).toBe(true)
  })

  it('/api/usage public path DEĞİL (auth redirect uygulanır)', () => {
    expect(isPublicPath('/api/usage')).toBe(false)
  })
})
```

Run: `npx vitest run tests/vitest/unit/http/routeAccess.test.ts` → Expected: PASS.

- [ ] **Step 2: proxy.ts'e usage limiter'ı ekle**

`proxy.ts` — `limiters` kaydına bir satır (mevcut `'api:'` satırının üstüne):

```ts
      'usage:':      new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(120, '60 s'), prefix: 'rl:usage' }),
```

Ve rate limit bloklarına, mevcut `if (pathname.startsWith('/api/') ...)` bloğunun ÜSTÜNE:

```ts
  // Usage beacon — okul IP'sinden 120/dk; kritik veri değil, Redis yoksa geçir (fail-open)
  if (pathname === '/api/usage') {
    if (!(await checkRateLimit(`usage:${ip}`, 120, 60_000, false))) {
      return new NextResponse(null, { status: 429 })
    }
  }
```

- [ ] **Step 3: API route'u yaz**

`app/api/usage/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/src/infrastructure/supabase/server'
import { FEATURES } from '@/src/shared/usage/featureMap'
import { logger } from '@/src/infrastructure/observability/logger'

const bodySchema = z.object({ feature: z.enum(FEATURES) }).strict()

// Kullanım beacon'ı — her durumda 204: metrik yazımı hiçbir istemci akışını kırmaz.
// Kimlik (user/school/role) istemciden alınmaz; increment_usage RPC auth.uid()'den türetir.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) return new NextResponse(null, { status: 204 })

  const supabase = await createClient()
  const { error } = await supabase.rpc('increment_usage', { p_feature: parsed.data.feature })
  if (error) {
    logger.warn({ event: 'usage_beacon_failed', err: error.message }, 'Kullanım metriği yazılamadı')
  }
  return new NextResponse(null, { status: 204 })
}
```

- [ ] **Step 4: Typecheck + build doğrulaması**

Run: `npx tsc --noEmit`
Expected: hata yok. (`rpc('increment_usage', ...)` tipi Task 1'deki regen sayesinde tanınır.)

- [ ] **Step 5: Commit + push**

```bash
git add app/api/usage/route.ts src/infrastructure/http/routeAccess.ts proxy.ts tests/vitest/unit/http/routeAccess.test.ts
git commit -m "feat: /api/usage beacon endpoint'i + usage rate-limit"
git push origin main
```

---

### Task 4: `UsageTracker` client component'i + layout entegrasyonu

**Files:**
- Create: `app/(dashboard)/UsageTracker.tsx`
- Modify: `app/(dashboard)/layout.tsx`

**Interfaces:**
- Consumes: Task 2'den `featureFromPath`; Task 3'ten `POST /api/usage`.
- Produces: dashboard'da route değişiminde beacon atan görünmez component (`null` render eder).

- [ ] **Step 1: Component'i yaz**

`app/(dashboard)/UsageTracker.tsx`:

```tsx
'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { featureFromPath } from '@/src/shared/usage/featureMap'

// Sayfa-görünümü beacon'ı. Aynı feature içinde gezinme (örn. /yoklama → /yoklama/5a)
// tekrar sayılmaz; feature değişince bir kez gönderilir.
export default function UsageTracker() {
  const pathname = usePathname()
  const lastFeature = useRef<string | null>(null)

  useEffect(() => {
    const feature = featureFromPath(pathname)
    if (!feature || feature === lastFeature.current) return
    lastFeature.current = feature

    const body = JSON.stringify({ feature })
    const blob = new Blob([body], { type: 'application/json' })
    if (!navigator.sendBeacon?.('/api/usage', blob)) {
      // sendBeacon yoksa/reddederse: keepalive fetch, hatası yutulur — metrik kritik değil
      fetch('/api/usage', { method: 'POST', body, keepalive: true }).catch(() => {})
    }
  }, [pathname])

  return null
}
```

- [ ] **Step 2: Layout'a ekle**

`app/(dashboard)/layout.tsx` — import bloğuna:

```tsx
import UsageTracker from './UsageTracker'
```

ve `<ToastProvider>` açılışının hemen içine (mevcut yapıyı bozmadan):

```tsx
    <ToastProvider>
      <UsageTracker />
      <div className="flex h-full bg-gray-50 dark:bg-slate-950">
```

- [ ] **Step 3: Manuel doğrulama (dev)**

Run: `npm run dev` → tarayıcıda login olup `/yoklama`'ya git → Network sekmesinde `POST /api/usage` (204) görün; Supabase'de kontrol:
`mcp__plugin_supabase_supabase__execute_sql` ile `select * from usage_daily order by day desc limit 5;`
Expected: feature='yoklama' satırı. (Dev doğrulaması yapılamıyorsa Task 7 e2e assert'i aynı şeyi kanıtlar — bu adımı atlamak kabul edilebilir.)

- [ ] **Step 4: Typecheck + unit suite**

Run: `npx tsc --noEmit` sonra `npm run test:unit`
Expected: temiz.

- [ ] **Step 5: Commit + push**

```bash
git add "app/(dashboard)/UsageTracker.tsx" "app/(dashboard)/layout.tsx"
git commit -m "feat: UsageTracker beacon component'i dashboard layout'una eklendi"
git push origin main
```

---

### Task 5: Feedback'i DB-öncelikli yap (`sendFeedback` + `page_path`)

**Files:**
- Modify: `app/actions/feedback.ts` (tamamen yeniden yazılır, aşağıda)
- Modify: `src/shared/validation/index.ts` (feedbackSchema eklenir)
- Modify: `components/FeedbackButton.tsx` (page_path hidden input)
- Test: `tests/vitest/unit/shared/feedbackSchema.test.ts`

**Interfaces:**
- Consumes: Task 1'den `feedback` tablosu (INSERT policy); mevcut `mailer`, `getCurrentUser`, `getCurrentProfile`, `createClient`, `createServiceClient`, `logger`.
- Produces: `sendFeedback(formData: FormData): Promise<{ ok: boolean; error?: string }>` (imza değişmez — FeedbackButton kırılmaz); `feedbackSchema` (Zod, `src/shared/validation`).

- [ ] **Step 1: Failing şema testini yaz**

`tests/vitest/unit/shared/feedbackSchema.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { feedbackSchema } from '@/src/shared/validation'

describe('feedbackSchema', () => {
  const valid = { category: 'oneri', message: 'Takvim harika olmuş', page_path: '/takvim' }

  it('geçerli girdiyi kabul eder', () => {
    expect(feedbackSchema.safeParse(valid).success).toBe(true)
  })

  it('bilinmeyen kategoriyi reddeder', () => {
    expect(feedbackSchema.safeParse({ ...valid, category: 'hata' }).success).toBe(false)
  })

  it('3 karakterden kısa mesajı reddeder', () => {
    expect(feedbackSchema.safeParse({ ...valid, message: 'ab' }).success).toBe(false)
  })

  it('2000 karakterden uzun mesajı reddeder', () => {
    expect(feedbackSchema.safeParse({ ...valid, message: 'a'.repeat(2001) }).success).toBe(false)
  })

  it('mesajı trim\'ler', () => {
    const r = feedbackSchema.safeParse({ ...valid, message: '  merhaba  ' })
    expect(r.success && r.data.message).toBe('merhaba')
  })

  it('page_path yoksa boş string\'e düşer', () => {
    const r = feedbackSchema.safeParse({ category: 'istek', message: 'yeni özellik' })
    expect(r.success && r.data.page_path).toBe('')
  })
})
```

Run: `npx vitest run tests/vitest/unit/shared/feedbackSchema.test.ts`
Expected: FAIL — feedbackSchema export edilmiyor.

- [ ] **Step 2: Şemayı ekle**

`src/shared/validation/index.ts` sonuna (mevcut export'ları bozmadan):

```ts
// Geri bildirim formu — kategori seti components/FeedbackButton.tsx ile birebir
export const feedbackSchema = z.object({
  category:  z.enum(['oneri', 'istek', 'sikayet']),
  message:   z.string().trim().min(3).max(2000),
  page_path: z.string().max(200).optional().default(''),
})
```

(Dosyada `z` zaten import edilidir; değilse `import { z } from 'zod'` ekle.)

Run: `npx vitest run tests/vitest/unit/shared/feedbackSchema.test.ts`
Expected: PASS (6 test).

- [ ] **Step 3: sendFeedback'i yeniden yaz**

`app/actions/feedback.ts` (tam içerik):

```ts
'use server'

import { mailer } from '@/src/lib/mailer'
import { getCurrentUser, getCurrentProfile } from '@/src/shared/auth'
import { createClient } from '@/src/infrastructure/supabase/server'
import { createServiceClient } from '@/src/infrastructure/supabase/service'
import { feedbackSchema } from '@/src/shared/validation'
import { logger } from '@/src/infrastructure/observability/logger'

const CATEGORY_LABELS: Record<string, string> = {
  oneri:   'Öneri',
  istek:   'İstek',
  sikayet: 'Şikayet',
}

export async function sendFeedback(formData: FormData) {
  const user = await getCurrentUser()
  if (!user) return { ok: false, error: 'Giriş yapılmamış.' }

  const profile = await getCurrentProfile()
  if (!profile?.school_id) return { ok: false, error: 'Profil bulunamadı.' }

  const parsed = feedbackSchema.safeParse({
    category:  formData.get('category'),
    message:   formData.get('message'),
    page_path: formData.get('page_path') ?? undefined,
  })
  if (!parsed.success) return { ok: false, error: 'Mesaj boş veya çok uzun.' }
  const { category, message, page_path } = parsed.data

  // Rate limit: son 60 sn'de 3+ kayıt varsa reddet.
  // feedback'te SELECT policy yok → sayım service client ile yapılır.
  const service = createServiceClient()
  const { count } = await service
    .from('feedback')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('created_at', new Date(Date.now() - 60_000).toISOString())
  if ((count ?? 0) >= 3) {
    return { ok: false, error: 'Çok sık gönderiyorsun, biraz sonra tekrar dene.' }
  }

  // Asıl kalıcı kayıt: DB. SELECT policy olmadığından .select() ÇAĞRILMAZ.
  const supabase = await createClient()
  const { error } = await supabase.from('feedback').insert({
    school_id: profile.school_id,
    user_id:   user.id,
    role:      profile.role,
    page_path: page_path || '/',
    category,
    message,
  })
  if (error) {
    logger.error({ event: 'feedback_insert_failed', err: error.message }, 'Feedback kaydedilemedi')
    return { ok: false, error: 'Kaydedilemedi. Lütfen tekrar dene.' }
  }

  // Mail best-effort: DB kaydı başarılı olduğu için mail patlasa da ok döner.
  const categoryLabel = CATEGORY_LABELS[category] ?? 'Öneri'
  const now = new Date().toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })
  try {
    await mailer.sendMail({
      subject: `[EduDesk] ${categoryLabel} — ${now}`,
      text: [
        `Tür: ${categoryLabel}`,
        `Sayfa: ${page_path || '-'}`,
        `Tarih: ${now}`,
        '',
        message,
      ].join('\n'),
    })
  } catch (err) {
    logger.warn({ event: 'feedback_mail_failed', err: String(err) }, 'Feedback maili gönderilemedi (kayıt DB\'de)')
  }

  return { ok: true }
}
```

Not: `profile.role` tipi `getCurrentProfile()` dönüşünde yoksa (tsc söyler), `(dashboard)/layout.tsx`'teki kullanımına bak — orada `profile?.role === 'mudur'` var, tip mevcuttur.

- [ ] **Step 4: FeedbackButton'a page_path ekle**

`components/FeedbackButton.tsx` — import'a:

```tsx
import { usePathname } from 'next/navigation'
```

component gövdesinin başına (mevcut state'lerin yanına):

```tsx
  const pathname = usePathname()
```

ve formdaki mevcut `<input type="hidden" name="category" value={category} />` satırının hemen altına:

```tsx
                  <input type="hidden" name="page_path" value={pathname ?? ''} />
```

- [ ] **Step 5: Typecheck + unit suite**

Run: `npx tsc --noEmit` sonra `npm run test:unit`
Expected: temiz.

- [ ] **Step 6: Commit + push**

```bash
git add app/actions/feedback.ts src/shared/validation/index.ts components/FeedbackButton.tsx tests/vitest/unit/shared/feedbackSchema.test.ts
git commit -m "feat: feedback DB-oncelikli kayit + page_path (mail best-effort'a dustu)"
git push origin main
```

---

### Task 6: /platform kullanım özeti + feedback listesi

**Files:**
- Create: `app/platform/UsageSummary.tsx`
- Create: `app/platform/FeedbackList.tsx`
- Modify: `app/platform/page.tsx` (iki bölümün eklenmesi)

**Interfaces:**
- Consumes: Task 1'den `usage_summary`, `usage_active_users` view'ları ve `feedback` tablosu; `createServiceClient()`.
- Produces: /platform sayfasında iki yeni server-component bölümü. Props almazlar (kendi sorgularını yaparlar).

- [ ] **Step 1: UsageSummary component'i**

`app/platform/UsageSummary.tsx`:

```tsx
import { createServiceClient } from '@/src/infrastructure/supabase/service'

// Okul bazında kullanım özeti — usage_summary / usage_active_users view'ları (son 30 gün)
export default async function UsageSummary() {
  const supabase = createServiceClient()
  const [{ data: active }, { data: summary }] = await Promise.all([
    supabase.from('usage_active_users').select('*').order('users_30d', { ascending: false }),
    supabase.from('usage_summary').select('*').order('views_30d', { ascending: false }),
  ])

  if (!active?.length) {
    return (
      <section>
        <h2 className="text-lg font-semibold text-white mb-3">Kullanım</h2>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-slate-500">
          Henüz kullanım verisi yok.
        </div>
      </section>
    )
  }

  return (
    <section>
      <h2 className="text-lg font-semibold text-white mb-3">Kullanım (son 30 gün)</h2>
      <div className="space-y-3">
        {active.map(school => {
          const topFeatures = (summary ?? [])
            .filter(r => r.school_id === school.school_id)
            .slice(0, 5)
          return (
            <div key={school.school_id} className="bg-slate-900 border border-slate-800 rounded-xl px-5 py-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-white">{school.school_name}</p>
                <p className="text-xs text-slate-400">
                  Aktif kullanıcı: <span className="text-emerald-400 font-semibold">{school.users_7d}</span> (7g)
                  {' · '}
                  <span className="text-sky-400 font-semibold">{school.users_30d}</span> (30g)
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {topFeatures.map(f => (
                  <span key={String(f.feature)} className="text-xs bg-slate-800 text-slate-300 rounded-full px-2.5 py-1">
                    {f.feature} · {f.views_30d}
                  </span>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
```

- [ ] **Step 2: FeedbackList component'i**

`app/platform/FeedbackList.tsx`:

```tsx
import { createServiceClient } from '@/src/infrastructure/supabase/service'

const CATEGORY_BADGES: Record<string, string> = {
  oneri:   '💡 Öneri',
  istek:   '🙏 İstek',
  sikayet: '⚠️ Şikayet',
}

// Son 50 geri bildirim — yalnızca service-role okuyabilir (tabloda SELECT policy yok)
export default async function FeedbackList() {
  const supabase = createServiceClient()
  const { data: items } = await supabase
    .from('feedback')
    .select('id, role, page_path, category, message, created_at, schools(name)')
    .order('created_at', { ascending: false })
    .limit(50)

  return (
    <section>
      <h2 className="text-lg font-semibold text-white mb-3">Geri Bildirimler</h2>
      {!items?.length ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-slate-500">
          Henüz geri bildirim yok.
        </div>
      ) : (
        <div className="space-y-2">
          {items.map(item => (
            <div key={item.id} className="bg-slate-900 border border-slate-800 rounded-xl px-5 py-3">
              <div className="flex items-center gap-2 text-xs text-slate-400 mb-1.5">
                <span>{CATEGORY_BADGES[item.category] ?? item.category}</span>
                <span>·</span>
                <span>{item.schools?.name ?? '—'}</span>
                <span>·</span>
                <span>{item.role}</span>
                <span>·</span>
                <span>{item.page_path}</span>
                <span className="ml-auto">
                  {new Date(item.created_at).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })}
                </span>
              </div>
              <p className="text-sm text-slate-200 whitespace-pre-wrap">{item.message}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
```

- [ ] **Step 3: page.tsx'e bölümleri ekle**

`app/platform/page.tsx` — import bloğuna:

```tsx
import UsageSummary from './UsageSummary'
import FeedbackList from './FeedbackList'
```

ve JSX'te okul listesi bölümünün KAPANIŞINDAN sonra, en dıştaki `</div>`'den önce:

```tsx
      <UsageSummary />
      <FeedbackList />
```

(En dış `<div className="space-y-8">` olduğundan bölüm araları otomatik açılır.)

- [ ] **Step 4: Typecheck + görsel doğrulama**

Run: `npx tsc --noEmit`
Expected: temiz. (`schools(name)` join tipi FK sayesinde nested object döner; tsc `item.schools?.name`'i kabul etmezse tipe bak — PostgREST'te to-one join bazen dizi tiplenir, o durumda `Array.isArray(item.schools) ? item.schools[0]?.name : item.schools?.name` yerine sorguya `schools!inner(name)` yaz ve tekrar dene.)

Dev'de `/platform` açılıp iki bölümün render olduğu görülür (veri yoksa boş-durum metinleri).

- [ ] **Step 5: Commit + push**

```bash
git add app/platform/UsageSummary.tsx app/platform/FeedbackList.tsx app/platform/page.tsx
git commit -m "feat: /platform kullanim ozeti + geri bildirim listesi"
git push origin main
```

---

### Task 7: E2E — feedback formu + usage beacon

**Files:**
- Create: `tests/playwright/e2e/feedback.spec.ts`

**Interfaces:**
- Consumes: Task 3–5'in tamamı (beacon endpoint'i, UsageTracker, sendFeedback, FeedbackButton); mevcut `tests/playwright/.auth/ogretmen.json` storage state.
- Produces: regresyon güvencesi — beacon atılıyor ve feedback uçtan uca kaydediliyor.

- [ ] **Step 1: E2E spec'i yaz**

`tests/playwright/e2e/feedback.spec.ts`:

```ts
import { test, expect } from '@playwright/test'
import path from 'path'

const AUTH_DIR = path.join(process.cwd(), 'tests/playwright/.auth')

test.describe('Geri bildirim + kullanım beacon\'ı', () => {
  test.use({ storageState: path.join(AUTH_DIR, 'ogretmen.json') })

  test('anasayfa ziyareti usage beacon\'ı atar', async ({ page }) => {
    const beacon = page.waitForRequest(
      req => req.url().includes('/api/usage') && req.method() === 'POST',
      { timeout: 15_000 }
    )
    await page.goto('/anasayfa')
    const req = await beacon
    expect(req.postDataJSON()).toEqual({ feature: 'anasayfa' })
  })

  test('feedback formu gönderilir ve teşekkür mesajı görünür', async ({ page }) => {
    await page.goto('/anasayfa')
    await page.getByRole('button', { name: 'Öneri & Destek' }).click()
    await page.getByPlaceholder('Mesajınızı buraya yazın…').fill('E2E test geri bildirimi — otomatik')
    await page.getByRole('button', { name: 'Gönder' }).click()
    await expect(page.getByText('Mesajın iletildi, teşekkürler!')).toBeVisible({ timeout: 10_000 })
  })
})
```

Not: `sendBeacon` istekleri Playwright'ta `page.waitForRequest` ile yakalanır (Chromium destekler). Yakalanmazsa (flaky), ilk testi şu alternatife çevir: sayfaya gidip 2 sn bekle, ardından `mcp__plugin_supabase_supabase__execute_sql` yerine test içinde assert edilemeyeceğinden bu testi network-yanıt bazlı yap: `page.waitForResponse(r => r.url().includes('/api/usage') && r.status() === 204)`.

- [ ] **Step 2: E2E'yi çalıştır**

Run: `npx playwright test tests/playwright/e2e/feedback.spec.ts`
Expected: 2/2 PASS. (Rate-limit güvencesi: sınır 60 sn'de 3 — testin tek gönderimi ve retry'ları kırmaz.)

- [ ] **Step 3: Tam doğrulama**

Run: `npm run test:unit` sonra `npx playwright test`
Expected: unit suite temiz; e2e tam takım (72/72 — mevcut 70 + yeni 2) PASS.
Sonra: `mcp__plugin_supabase_supabase__get_advisors` (security) — yeni tablo/fonksiyon için beklenmeyen bulgu yok (`increment_usage` search_path sabitli, view'lar security_invoker).

- [ ] **Step 4: Commit + push**

```bash
git add tests/playwright/e2e/feedback.spec.ts
git commit -m "test: feedback + usage beacon e2e"
git push origin main
```
