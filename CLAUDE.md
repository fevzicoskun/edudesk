# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## ⚠️ Next.js Version Warning

This project uses a **non-standard Next.js version** with breaking changes. Before writing any Next.js code, read `node_modules/next/dist/docs/`. Key differences from standard Next.js:
- Middleware file is named `proxy.ts`, not `middleware.ts`
- Some App Router APIs may behave differently

## Commands

```bash
npm run dev          # Dev server (webpack mode)
npm run build        # Production build
npm run test         # All tests
npm run test:unit    # Unit tests only (tests/vitest/unit/)
npm run test:integration  # Integration tests (hits real Supabase)
npx vitest run tests/vitest/unit/path/to/file.test.ts  # Single test file
```

## Architecture

**Stack:** Next.js App Router, React 19, Tailwind v4, Supabase SSR, TypeScript, Inngest (background jobs), Resend (email), Vitest.

**Domain structure** (`src/domains/`):
- Each domain has `repositories/` → `services/` → `actions/` layers
- Repositories: raw Supabase calls, no business logic
- Services: RBAC checks via `getAbility()`, orchestration
- Actions: thin `app/actions/` server actions that validate → call service → `revalidatePath`

**Auth & RBAC:**
- `src/shared/auth` — `getCurrentProfile()`, `getCurrentUser()`
- `src/shared/permissions` — `P.RESOURCE.ACTION` constants
- `getAbility()` returns `{ userId, schoolId, can(), cannot(), scope() }` — always call this in services
- Roles: `ogretmen`, `zumre_baskani`, `mudur_yardimcisi`, `mudur`, `admin`
- Multi-tenant: every DB table has `school_id`, enforced by Supabase RLS

**Data flow:**
```
app/actions/  →  src/domains/*/services/  →  src/domains/*/repositories/  →  Supabase
```
Server components call Supabase directly (read-only, no mutations). Mutations go through server actions.

**Validation:** Zod schemas in `src/shared/validation/index.ts` and `src/domains/*/validators/`. Always validate at action boundary, trust service inputs.

**Background jobs:** Inngest functions in `src/domains/notifications/functions/`. Registered in `app/api/inngest/route.ts`.

**Testing:**
- Unit: pure functions, no DB
- Integration: hits real Supabase test project (needs `.env.local`)
- Test files mirror `src/` structure under `tests/vitest/`

## Key Conventions

- `deleted_at` soft-delete pattern on all major tables — always filter `.is('deleted_at', null)`
- `school_id` on every query — never skip this filter
- Server components use `createClient()` from `src/infrastructure/supabase/server`
- `revalidatePath('/path')` after every mutation, then `redirect()` if needed
- HTML in emails: always escape user content with an `esc()` function before interpolating
- Supabase project ID: `agijvfrcudpzsofgfogu`

## Kalıcı Dersler (pahalıya öğrenildi — tekrar etme)

- **Turbopack YASAK** (dev + playwright webServer): bu projede dev sunucusunu çökertiyor. Her zaman webpack modu (`npm run dev` zaten webpack).
- **Yeni tablo migration'ından sonra DB tiplerini regen et** — yoksa tsc kırılır (`database.types.ts`).
- **Yeni dashboard modülünde `featureMap.ts` + `increment_usage` DB whitelist'i BİRLİKTE güncellenir** — biri eksikse beacon sessizce düşer.
- **RLS helper SECURITY DEFINER fn'lerden anon/authenticated EXECUTE ÇEKME** — production'ı kilitler (advisor 0028/0029 bilinçli kabul).
- **`.limit(BÜYÜK_SAYI)` + JS-tarafı gruplama = sessiz truncation bug'ı** — sayım/agregat Postgres `group by`/RPC'de yapılır.
- **PostgREST `numeric`'i string döndürür** (bigint/float8 number) — RPC'de `::float8` cast + tüketicide `Number()`.
- **Saat-bağımlı UI e2e'sinde `page.clock` yetmez** — kilit SSR'da gerçek saatle hesaplanır; yetki-bypass'lı rol kullan.
- **Responsive ikiz içerik (`hidden md:block`/`md:hidden`) Playwright strict mode'u patlatır** — `{ exact: true }` / `.first()` / kapsamlı locator.
- **`isPublicPath` `startsWith(p+'/')` mantığı**: `/api/...` route'ları üst path ile kapsanmaz, tek tek `PUBLIC_PATHS`'e eklenir (`src/infrastructure/http/routeAccess.ts`, testli).
- **Next.js metadata route'ları (robots/sitemap/manifest) `proxy.ts` matcher'ından muaf tutulmalı** — yoksa middleware onları gölgeler (307).
- **feedback yazımı YALNIZ `submit_feedback` RPC** — INSERT policy bilinçli yok; `.insert().select()` deseni bu tabloda YASAK (SELECT policy yok).
- Ödeme araştırması sonucu: **Stripe Türkiye'ye kapalı** — abonelik işi iyzico veya manuel havale üzerinden planlanır.
