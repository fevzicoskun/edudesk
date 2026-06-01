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
