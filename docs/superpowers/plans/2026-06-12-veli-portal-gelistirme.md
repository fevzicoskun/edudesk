# Veli Portal Geliştirme — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Veli portalına WhatsApp paylaşımı, toplu link gönderimi, token süre göstergesi ve öğretmen için engagement analytics eklemek.

**Architecture:** Yeni `veli_portal_events` DB tablosu; client-side `VeliTracker` → `/api/veli/event` API route → service client insert; öğretmen analytics için `VeliAnalyticsRepository` → `VeliAnalyticsCard` server component + `OgrenciListesi` badge. Pure functions `src/domains/classes/lib/veliPortal.ts`'te, unit testleri `tests/vitest/unit/classes/veli-portal.test.ts`'te.

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase service client, Tailwind v4, Web Beacon API, Supabase MCP

---

## Dosya Haritası

| Dosya | Değişiklik |
|---|---|
| `supabase/migrations/20260612000000_add_veli_portal_events.sql` | YENİ — migration |
| `src/infrastructure/supabase/database.types.ts` | Regenerate (MCP) |
| `src/domains/classes/lib/veliPortal.ts` | YENİ — pure functions |
| `tests/vitest/unit/classes/veli-portal.test.ts` | YENİ — unit tests |
| `app/api/veli/event/route.ts` | YENİ — event API |
| `app/veli/[token]/VeliTracker.tsx` | YENİ — client tracker |
| `app/veli/[token]/page.tsx` | data-veli-section attrs + VeliTracker + expiry badge |
| `app/(dashboard)/siniflar/[id]/ogrenciler/[studentId]/CopyVeliLink.tsx` | studentName + veliAd props + WhatsApp butonu |
| `app/(dashboard)/siniflar/[id]/ogrenciler/[studentId]/page.tsx` | CopyVeliLink'e props geç |
| `app/actions/tokens.ts` | generateBulkVeliTokens + BulkTokenResult type |
| `app/(dashboard)/siniflar/[id]/BulkVeliLinkModal.tsx` | YENİ — toplu link modal |
| `app/(dashboard)/siniflar/[id]/page.tsx` | veli_ad + viewCounts query + modal trigger |
| `app/(dashboard)/siniflar/[id]/OgrenciListesi.tsx` | viewCounts prop + badge |
| `src/domains/classes/repositories/VeliAnalyticsRepository.ts` | YENİ — analytics queries |
| `app/(dashboard)/siniflar/[id]/ogrenciler/[studentId]/VeliAnalyticsCard.tsx` | YENİ — analytics UI |
| `app/(dashboard)/siniflar/[id]/ogrenciler/[studentId]/page.tsx` | VeliAnalyticsCard + analytics query |

---

### Task 1: DB Migration + TypeScript Types

**Files:**
- Create: `supabase/migrations/20260612000000_add_veli_portal_events.sql`
- Modify: `src/infrastructure/supabase/database.types.ts` (regenerate)

- [ ] **Step 1: Migration'ı Supabase MCP ile uygula**

Supabase project_id: `agijvfrcudpzsofgfogu`

```sql
CREATE TABLE IF NOT EXISTS veli_portal_events (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  token_jti     TEXT NOT NULL,
  student_id    UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  school_id     UUID NOT NULL,
  event_type    TEXT NOT NULL CHECK (event_type IN ('page_view', 'section_view', 'session_end')),
  section       TEXT CHECK (section IN ('odevler', 'devamsizlik', 'notlar')),
  duration_sec  INTEGER CHECK (duration_sec >= 0 AND duration_sec <= 7200),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vpe_student  ON veli_portal_events(student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vpe_school   ON veli_portal_events(school_id);
CREATE INDEX IF NOT EXISTS idx_vpe_jti      ON veli_portal_events(token_jti);

ALTER TABLE veli_portal_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vpe_school_read" ON veli_portal_events
  FOR SELECT TO authenticated
  USING (school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()));
```

Supabase MCP `apply_migration` aracını kullan: `name = "add_veli_portal_events"`, yukarıdaki SQL.

- [ ] **Step 2: Migration dosyasını local'e kaydet**

`supabase/migrations/20260612000000_add_veli_portal_events.sql` içine aynı SQL'i yaz.

- [ ] **Step 3: TypeScript tiplerini Supabase MCP ile yeniden oluştur**

Supabase MCP `generate_typescript_types` aracını kullan, çıktıyı `src/infrastructure/supabase/database.types.ts` dosyasına yaz.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260612000000_add_veli_portal_events.sql src/infrastructure/supabase/database.types.ts
git commit -m "feat(veli): add veli_portal_events table + regenerate types"
```

---

### Task 2: Pure Function Library + Unit Tests

**Files:**
- Create: `src/domains/classes/lib/veliPortal.ts`
- Create: `tests/vitest/unit/classes/veli-portal.test.ts`

- [ ] **Step 1: Failing testleri yaz**

`tests/vitest/unit/classes/veli-portal.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { aggregateVeliEvents, buildWhatsAppUrl } from '@/src/domains/classes/lib/veliPortal'

describe('aggregateVeliEvents', () => {
  it('returns null for empty events', () => {
    expect(aggregateVeliEvents([])).toBeNull()
  })

  it('counts page_view events as totalViews', () => {
    const events = [
      { event_type: 'page_view',    section: null,       duration_sec: null, created_at: '2026-06-12T10:00:00Z' },
      { event_type: 'page_view',    section: null,       duration_sec: null, created_at: '2026-06-11T10:00:00Z' },
      { event_type: 'section_view', section: 'odevler',  duration_sec: null, created_at: '2026-06-12T10:01:00Z' },
      { event_type: 'section_view', section: 'odevler',  duration_sec: null, created_at: '2026-06-12T10:02:00Z' },
      { event_type: 'session_end',  section: null,       duration_sec: 300,  created_at: '2026-06-12T10:05:00Z' },
    ]
    const result = aggregateVeliEvents(events)!
    expect(result.totalViews).toBe(2)
    expect(result.totalDurationSec).toBe(300)
    expect(result.sections).toEqual(['odevler'])        // deduplicated
    expect(result.lastViewedAt).toBe('2026-06-12T10:00:00Z')
  })

  it('sums duration across multiple sessions', () => {
    const events = [
      { event_type: 'session_end', section: null, duration_sec: 120, created_at: '2026-06-11T10:00:00Z' },
      { event_type: 'session_end', section: null, duration_sec: 180, created_at: '2026-06-12T10:00:00Z' },
    ]
    expect(aggregateVeliEvents(events)!.totalDurationSec).toBe(300)
  })
})

describe('buildWhatsAppUrl', () => {
  it('includes veli adı in greeting when provided', () => {
    const url = buildWhatsAppUrl('Ali Vural', 'Fatma Hanım', 'https://myedudesk.com.tr/veli/v1.abc')
    expect(decodeURIComponent(url)).toContain('Sayın Fatma Hanım')
    expect(decodeURIComponent(url)).toContain('Ali Vural')
  })

  it('uses generic greeting when veliAd is null', () => {
    const url = buildWhatsAppUrl('Ali Vural', null, 'https://myedudesk.com.tr/veli/v1.abc')
    expect(decodeURIComponent(url)).toContain('Merhaba')
    expect(decodeURIComponent(url)).not.toContain('Sayın')
  })

  it('URL encodes the message', () => {
    const url = buildWhatsAppUrl('Ali', null, 'https://example.com')
    expect(url).toMatch(/^https:\/\/wa\.me\/\?text=/)
  })
})
```

- [ ] **Step 2: Testleri çalıştır, fail ettiğini doğrula**

```bash
npx vitest run tests/vitest/unit/classes/veli-portal.test.ts
```

Beklenen: FAIL (modül yok)

- [ ] **Step 3: Pure function library'yi yaz**

`src/domains/classes/lib/veliPortal.ts`:

```ts
export interface VeliEvent {
  event_type: string
  section: string | null
  duration_sec: number | null
  created_at: string
}

export interface VeliAnalyticsResult {
  totalViews: number
  lastViewedAt: string | null
  totalDurationSec: number
  sections: string[]
}

export function aggregateVeliEvents(events: VeliEvent[]): VeliAnalyticsResult | null {
  if (!events.length) return null
  const pageViews  = events.filter(e => e.event_type === 'page_view')
  const sessionEnds = events.filter(e => e.event_type === 'session_end')
  const sectionViews = events.filter(e => e.event_type === 'section_view')
  return {
    totalViews:      pageViews.length,
    lastViewedAt:    pageViews[0]?.created_at ?? null,
    totalDurationSec: sessionEnds.reduce((sum, e) => sum + (e.duration_sec ?? 0), 0),
    sections:        [...new Set(sectionViews.map(e => e.section).filter((s): s is string => s !== null))],
  }
}

export function buildWhatsAppUrl(studentName: string, veliAd: string | null, portalUrl: string): string {
  const greeting = veliAd ? `Sayın ${veliAd},` : 'Merhaba,'
  const text = `${greeting} ${studentName} için EduDesk veli portalı: ${portalUrl}`
  return `https://wa.me/?text=${encodeURIComponent(text)}`
}
```

- [ ] **Step 4: Testleri çalıştır, pass ettiğini doğrula**

```bash
npx vitest run tests/vitest/unit/classes/veli-portal.test.ts
```

Beklenen: 5 test PASS

- [ ] **Step 5: Commit**

```bash
git add src/domains/classes/lib/veliPortal.ts tests/vitest/unit/classes/veli-portal.test.ts
git commit -m "feat(veli): veliPortal pure functions + unit tests"
```

---

### Task 3: /api/veli/event API Route

**Files:**
- Create: `app/api/veli/event/route.ts`

- [ ] **Step 1: Route dosyasını oluştur**

`app/api/veli/event/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/src/infrastructure/supabase/service'
import { verifyPublicToken, isTokenRevoked, looksLikeToken } from '@/src/infrastructure/tokens'

const VALID_EVENT_TYPES = ['page_view', 'section_view', 'session_end'] as const
const VALID_SECTIONS    = ['odevler', 'devamsizlik', 'notlar'] as const

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Geçersiz JSON' }, { status: 400 })
  }

  const { token, event_type, section, duration_sec } = body

  if (typeof token !== 'string' || !looksLikeToken(token)) {
    return NextResponse.json({ error: 'Geçersiz token' }, { status: 400 })
  }

  if (!VALID_EVENT_TYPES.includes(event_type as typeof VALID_EVENT_TYPES[number])) {
    return NextResponse.json({ error: 'Geçersiz event_type' }, { status: 400 })
  }

  if (event_type === 'section_view' && !VALID_SECTIONS.includes(section as typeof VALID_SECTIONS[number])) {
    return NextResponse.json({ error: 'Geçersiz section' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const result = await verifyPublicToken(token, 'veli')
  if (!result.ok) return NextResponse.json({ error: 'Geçersiz token' }, { status: 401 })

  const revoked = await isTokenRevoked(result.payload.jti, supabase)
  if (revoked) return NextResponse.json({ error: 'Token iptal edilmiş' }, { status: 401 })

  const schoolId = result.payload.m?.school_id
  if (!schoolId) return NextResponse.json({ error: 'Eksik school_id' }, { status: 400 })

  const durationSec = event_type === 'session_end' && typeof duration_sec === 'number'
    ? Math.min(Math.max(0, Math.round(duration_sec)), 7200)
    : null

  await supabase.from('veli_portal_events').insert({
    token_jti:   result.payload.jti,
    student_id:  result.payload.id,
    school_id:   schoolId,
    event_type:  event_type as string,
    section:     event_type === 'section_view' ? (section as string) : null,
    duration_sec: durationSec,
  })

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/veli/event/route.ts
git commit -m "feat(veli): /api/veli/event endpoint — event tracking API"
```

---

### Task 4: VeliTracker + Veli Sayfası Değişiklikleri

**Files:**
- Create: `app/veli/[token]/VeliTracker.tsx`
- Modify: `app/veli/[token]/page.tsx`

- [ ] **Step 1: VeliTracker.tsx oluştur**

`app/veli/[token]/VeliTracker.tsx`:

```tsx
'use client'

import { useEffect } from 'react'

interface Props { token: string }

export default function VeliTracker({ token }: Props) {
  useEffect(() => {
    const startTime = Date.now()
    const seenSections = new Set<string>()

    fetch('/api/veli/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, event_type: 'page_view' }),
    }).catch(() => {})

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          const section = (entry.target as HTMLElement).dataset.veliSection
          if (!section || seenSections.has(section)) continue
          seenSections.add(section)
          fetch('/api/veli/event', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, event_type: 'section_view', section }),
          }).catch(() => {})
        }
      },
      { threshold: 0.3 }
    )
    document.querySelectorAll('[data-veli-section]').forEach(el => observer.observe(el))

    const handleHidden = () => {
      if (document.visibilityState !== 'hidden') return
      const durationSec = Math.round((Date.now() - startTime) / 1000)
      navigator.sendBeacon(
        '/api/veli/event',
        new Blob(
          [JSON.stringify({ token, event_type: 'session_end', duration_sec: durationSec })],
          { type: 'application/json' }
        )
      )
    }
    document.addEventListener('visibilitychange', handleHidden)

    return () => {
      observer.disconnect()
      document.removeEventListener('visibilitychange', handleHidden)
    }
  }, [token])

  return null
}
```

- [ ] **Step 2: app/veli/[token]/page.tsx — 3 değişiklik yap**

**Değişiklik A — expiry değişkenlerini** `studentId = result.payload.id` satırının hemen altına ekle:

```ts
const expiresAt  = new Date(result.payload.exp * 1000)
const daysLeft   = Math.ceil((expiresAt.getTime() - Date.now()) / 86_400_000)
const expiryText = daysLeft > 30
  ? `${expiresAt.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })} kadar geçerli`
  : daysLeft > 1 ? `${daysLeft} gün kaldı` : 'Bugün geçecek'
const expiryColor = daysLeft > 30
  ? 'text-green-600 bg-green-50 border-green-200'
  : daysLeft > 7 ? 'text-yellow-600 bg-yellow-50 border-yellow-200'
  : 'text-orange-600 bg-orange-50 border-orange-200'
```

**Değişiklik B — header'a expiry badge** ekle. Mevcut header'daki `<p className="text-base font-bold...">` satırının altına:

```tsx
<span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border mt-1 inline-block ${expiryColor}`}>
  🔗 {expiryText}
</span>
```

**Değişiklik C — `<main>` açılışının hemen içine** VeliTracker ekle (import + kullanım):

Dosya başına import ekle:
```tsx
import VeliTracker from './VeliTracker'
```

`<main className="...">` hemen içine:
```tsx
<VeliTracker token={token} />
```

Upcoming section'a:
```tsx
<section data-veli-section="odevler" className="...">
```

Attendance section'a:
```tsx
<section data-veli-section="devamsizlik" className="...">
```

Notes section'a:
```tsx
<section data-veli-section="notlar" className="...">
```

- [ ] **Step 3: tsc kontrol**

```bash
npx tsc --noEmit
```

Beklenen: 0 hata

- [ ] **Step 4: Commit**

```bash
git add app/veli/[token]/VeliTracker.tsx app/veli/[token]/page.tsx
git commit -m "feat(veli): engagement tracker + token expiry badge"
```

---

### Task 5: WhatsApp Paylaşım Butonu (CopyVeliLink)

**Files:**
- Modify: `app/(dashboard)/siniflar/[id]/ogrenciler/[studentId]/CopyVeliLink.tsx`
- Modify: `app/(dashboard)/siniflar/[id]/ogrenciler/[studentId]/page.tsx`

- [ ] **Step 1: CopyVeliLink.tsx — props + WhatsApp butonu ekle**

`CopyVeliLink.tsx` başındaki type ve export satırını değiştir:

```ts
// Eski:
export default function CopyVeliLink({ studentId }: { studentId: string }) {

// Yeni:
import { buildWhatsAppUrl } from '@/src/domains/classes/lib/veliPortal'

export default function CopyVeliLink({
  studentId,
  studentName,
  veliAd,
}: {
  studentId: string
  studentName: string
  veliAd: string | null
}) {
```

`fresh` gösterim bloğunda, mevcut "Kopyala" butonunun hemen ardına WhatsApp butonu ekle:

```tsx
<a
  href={buildWhatsAppUrl(studentName, veliAd, fresh.url)}
  target="_blank"
  rel="noopener noreferrer"
  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-green-200 dark:border-green-700 text-xs font-medium text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-950 transition-colors"
>
  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
    <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.555 4.116 1.524 5.847L0 24l6.337-1.501A11.956 11.956 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.891 0-3.663-.5-5.198-1.374l-.373-.22-3.863.915.977-3.762-.241-.388A9.937 9.937 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
  </svg>
  WhatsApp
</a>
```

- [ ] **Step 2: page.tsx — CopyVeliLink'e props geç**

`app/(dashboard)/siniflar/[id]/ogrenciler/[studentId]/page.tsx`'te:

```tsx
// Eski:
<CopyVeliLink studentId={studentId} />

// Yeni:
<CopyVeliLink
  studentId={studentId}
  studentName={student.full_name}
  veliAd={student.veli_ad ?? null}
/>
```

- [ ] **Step 3: tsc kontrol**

```bash
npx tsc --noEmit
```

Beklenen: 0 hata

- [ ] **Step 4: Commit**

```bash
git add app/(dashboard)/siniflar/\[id\]/ogrenciler/\[studentId\]/CopyVeliLink.tsx app/(dashboard)/siniflar/\[id\]/ogrenciler/\[studentId\]/page.tsx
git commit -m "feat(veli): WhatsApp paylaşım butonu"
```

---

### Task 6: generateBulkVeliTokens + BulkVeliLinkModal

**Files:**
- Modify: `app/actions/tokens.ts`
- Create: `app/(dashboard)/siniflar/[id]/BulkVeliLinkModal.tsx`
- Modify: `app/(dashboard)/siniflar/[id]/page.tsx`

- [ ] **Step 1: generateBulkVeliTokens action ekle**

`app/actions/tokens.ts` başına iki import ekle:

```ts
import { createPublicToken, extractJti } from '@/src/infrastructure/tokens'
import { TokenRepository } from '@/src/domains/tokens/repositories/TokenRepository'
```

Dosyanın sonuna ekle:

```ts
export type BulkTokenResult = {
  studentId: string
  studentName: string
  veliAd: string | null
  veliTelefon: string | null
  token: string
}

export async function generateBulkVeliTokens(classId: string): Promise<BulkTokenResult[]> {
  UUID.parse(classId)
  const [user, profile] = await Promise.all([getCurrentUser(), getCurrentProfile()])
  if (!user || !profile?.school_id) redirect('/login')

  const { createClient } = await import('@/src/infrastructure/supabase/server')
  const supabase = await createClient()

  const { data: students } = await supabase
    .from('students')
    .select('id, full_name, veli_ad, veli_telefon')
    .eq('class_id', classId)
    .eq('school_id', profile.school_id)
    .is('deleted_at', null)
    .order('full_name')

  if (!students?.length) return []

  const schoolId = profile.school_id
  const userId   = user.id
  const ttlDays  = 7

  return Promise.all(
    students.map(async (s) => {
      const token = await createPublicToken('veli', s.id, ttlDays, { school_id: schoolId })
      const jti = extractJti(token)
      if (jti) {
        await TokenRepository.insertVeliToken({
          student_id: s.id,
          school_id:  schoolId,
          issued_by:  userId,
          jti,
          expires_at: new Date(Date.now() + ttlDays * 86_400_000).toISOString(),
        })
      }
      return {
        studentId:   s.id,
        studentName: s.full_name,
        veliAd:      s.veli_ad     ?? null,
        veliTelefon: s.veli_telefon ?? null,
        token,
      }
    })
  )
}
```

- [ ] **Step 2: BulkVeliLinkModal.tsx oluştur**

`app/(dashboard)/siniflar/[id]/BulkVeliLinkModal.tsx`:

```tsx
'use client'

import { useState, useTransition } from 'react'
import { generateBulkVeliTokens, type BulkTokenResult } from '@/app/actions/tokens'
import { buildWhatsAppUrl } from '@/src/domains/classes/lib/veliPortal'

interface Props { classId: string }

export default function BulkVeliLinkModal({ classId }: Props) {
  const [open,    setOpen]    = useState(false)
  const [results, setResults] = useState<(BulkTokenResult & { url: string })[]>([])
  const [copied,  setCopied]  = useState<string | null>(null)
  const [isPending, start]    = useTransition()

  function handleOpen() {
    setOpen(true)
    if (results.length) return
    start(async () => {
      const data = await generateBulkVeliTokens(classId)
      const origin = window.location.origin
      setResults(data.map(r => ({ ...r, url: `${origin}/veli/${r.token}` })))
    })
  }

  function handleCopy(url: string, id: string) {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(id)
      setTimeout(() => setCopied(null), 2000)
    })
  }

  function handleCopyAll() {
    const text = results.map(r => `${r.studentName}: ${r.url}`).join('\n')
    navigator.clipboard.writeText(text).then(() => {
      setCopied('all')
      setTimeout(() => setCopied(null), 2000)
    })
  }

  if (!open) {
    return (
      <button
        onClick={handleOpen}
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-600 text-sm font-medium text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
        Toplu Veli Linki
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-slate-700">
          <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100">Toplu Veli Linki</h2>
          <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {isPending ? (
            <p className="text-sm text-gray-500 dark:text-slate-400 text-center py-8">Linkler oluşturuluyor…</p>
          ) : results.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-slate-500 text-center py-8">Öğrenci bulunamadı.</p>
          ) : (
            <div className="space-y-2">
              {results.map(r => (
                <div key={r.studentId} className="flex items-center gap-2 p-2 rounded-lg border border-gray-100 dark:border-slate-700">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">{r.studentName}</p>
                    {!r.veliTelefon && (
                      <p className="text-[10px] text-amber-500">Telefon eksik</p>
                    )}
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    {r.veliTelefon && (
                      <a
                        href={buildWhatsAppUrl(r.studentName, r.veliAd, r.url)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-lg border border-green-200 dark:border-green-700 text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-950 transition-colors"
                        title="WhatsApp'ta gönder"
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.555 4.116 1.524 5.847L0 24l6.337-1.501A11.956 11.956 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.891 0-3.663-.5-5.198-1.374l-.373-.22-3.863.915.977-3.762-.241-.388A9.937 9.937 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
                        </svg>
                      </a>
                    )}
                    <button
                      onClick={() => handleCopy(r.url, r.studentId)}
                      className="p-1.5 rounded-lg border border-gray-200 dark:border-slate-600 text-gray-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                      title="Kopyala"
                    >
                      {copied === r.studentId ? (
                        <svg className="w-3.5 h-3.5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {results.length > 0 && !isPending && (
          <div className="p-4 border-t border-gray-200 dark:border-slate-700">
            <button
              onClick={handleCopyAll}
              className="w-full py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              {copied === 'all' ? 'Kopyalandı ✓' : 'Tümünü Kopyala'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: siniflar/[id]/page.tsx — veli_ad ve modal ekle**

Öğrenci sorgusuna `veli_ad` ekle:

```ts
// Eski:
.select('id, full_name, student_number, veli_email, veli_telefon')

// Yeni:
.select('id, full_name, student_number, veli_email, veli_telefon, veli_ad')
```

Import ekle:
```ts
import BulkVeliLinkModal from './BulkVeliLinkModal'
```

Sayfa başlığının yanına (BulkStudentModal'ın yanına) butonu ekle:
```tsx
<BulkVeliLinkModal classId={id} />
```

- [ ] **Step 4: tsc kontrol**

```bash
npx tsc --noEmit
```

Beklenen: 0 hata

- [ ] **Step 5: Commit**

```bash
git add app/actions/tokens.ts "app/(dashboard)/siniflar/[id]/BulkVeliLinkModal.tsx" "app/(dashboard)/siniflar/[id]/page.tsx"
git commit -m "feat(veli): toplu link oluşturma modal"
```

---

### Task 7: VeliAnalyticsRepository

**Files:**
- Create: `src/domains/classes/repositories/VeliAnalyticsRepository.ts`

- [ ] **Step 1: Repository oluştur**

`src/domains/classes/repositories/VeliAnalyticsRepository.ts`:

```ts
import { createClient } from '@/src/infrastructure/supabase/server'
import { aggregateVeliEvents, type VeliAnalyticsResult } from '@/src/domains/classes/lib/veliPortal'

export const VeliAnalyticsRepository = {
  async getVeliAnalytics(studentId: string, schoolId: string): Promise<VeliAnalyticsResult | null> {
    const supabase = await createClient()
    const { data } = await supabase
      .from('veli_portal_events')
      .select('event_type, section, duration_sec, created_at')
      .eq('student_id', studentId)
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false })
      .limit(500)
    return aggregateVeliEvents(data ?? [])
  },

  async getVeliViewCounts(classId: string, schoolId: string): Promise<Record<string, number>> {
    const supabase = await createClient()

    const { data: students } = await supabase
      .from('students')
      .select('id')
      .eq('class_id', classId)
      .eq('school_id', schoolId)
      .is('deleted_at', null)

    if (!students?.length) return {}

    const studentIds = students.map(s => s.id)

    const { data: events } = await supabase
      .from('veli_portal_events')
      .select('student_id')
      .eq('event_type', 'page_view')
      .eq('school_id', schoolId)
      .in('student_id', studentIds)

    const counts: Record<string, number> = {}
    for (const e of events ?? []) {
      counts[e.student_id] = (counts[e.student_id] ?? 0) + 1
    }
    return counts
  },
}
```

- [ ] **Step 2: tsc kontrol**

```bash
npx tsc --noEmit
```

Beklenen: 0 hata

- [ ] **Step 3: Commit**

```bash
git add src/domains/classes/repositories/VeliAnalyticsRepository.ts
git commit -m "feat(veli): VeliAnalyticsRepository — analytics queries"
```

---

### Task 8: VeliAnalyticsCard + OgrenciListesi Badge

**Files:**
- Create: `app/(dashboard)/siniflar/[id]/ogrenciler/[studentId]/VeliAnalyticsCard.tsx`
- Modify: `app/(dashboard)/siniflar/[id]/ogrenciler/[studentId]/page.tsx`
- Modify: `app/(dashboard)/siniflar/[id]/OgrenciListesi.tsx`
- Modify: `app/(dashboard)/siniflar/[id]/page.tsx`

- [ ] **Step 1: VeliAnalyticsCard server component oluştur**

`app/(dashboard)/siniflar/[id]/ogrenciler/[studentId]/VeliAnalyticsCard.tsx`:

```tsx
import { VeliAnalyticsRepository } from '@/src/domains/classes/repositories/VeliAnalyticsRepository'
import { format, parseISO } from '@/src/shared/date'

const SECTION_LABELS: Record<string, string> = {
  odevler: 'Ödevler',
  devamsizlik: 'Devamsızlık',
  notlar: 'Notlar',
}

interface Props { studentId: string; schoolId: string }

export default async function VeliAnalyticsCard({ studentId, schoolId }: Props) {
  const analytics = await VeliAnalyticsRepository.getVeliAnalytics(studentId, schoolId)

  if (!analytics || analytics.totalViews === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">Veli Portal Aktivitesi</h2>
        <p className="text-sm text-gray-400 dark:text-slate-500">Veli henüz portalı açmamış.</p>
      </div>
    )
  }

  const durationMin = Math.round(analytics.totalDurationSec / 60)
  const lastViewed  = analytics.lastViewedAt
    ? format(parseISO(analytics.lastViewedAt), 'd MMM yyyy')
    : null

  return (
    <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4">
      <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3">Veli Portal Aktivitesi</h2>
      <div className="grid grid-cols-3 gap-3 mb-3">
        <div className="text-center">
          <p className="text-xl font-bold text-gray-900 dark:text-slate-100">{analytics.totalViews}</p>
          <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-0.5">Ziyaret</p>
        </div>
        <div className="text-center">
          <p className="text-xl font-bold text-gray-900 dark:text-slate-100">
            {durationMin > 0 ? `~${durationMin}` : '<1'}
          </p>
          <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-0.5">Dakika</p>
        </div>
        <div className="text-center">
          <p className="text-xs font-semibold text-gray-700 dark:text-slate-300">{lastViewed ?? '—'}</p>
          <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-0.5">Son Ziyaret</p>
        </div>
      </div>
      {analytics.sections.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {(['odevler', 'devamsizlik', 'notlar'] as const).map(s => (
            <span
              key={s}
              className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                analytics.sections.includes(s)
                  ? 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700'
                  : 'bg-gray-50 text-gray-300 border-gray-100 dark:bg-slate-700 dark:text-slate-500 dark:border-slate-600'
              }`}
            >
              {analytics.sections.includes(s) ? '✓ ' : ''}{SECTION_LABELS[s]}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Öğrenci profil sayfasına VeliAnalyticsCard ekle**

`app/(dashboard)/siniflar/[id]/ogrenciler/[studentId]/page.tsx`'e import ekle:
```ts
import VeliAnalyticsCard from './VeliAnalyticsCard'
```

`<ParentContactLogSection .../>` hemen öncesine ekle:
```tsx
<VeliAnalyticsCard studentId={studentId} schoolId={schoolId} />
```

- [ ] **Step 3: OgrenciListesi'ne viewCounts prop ekle**

`app/(dashboard)/siniflar/[id]/OgrenciListesi.tsx`:

`Props` interface'e ekle:
```ts
viewCounts?: Record<string, number>
```

`OgrenciSatiri` fonksiyonuna prop ekle:
```ts
function OgrenciSatiri({
  s, classId, canDelete, index, absenceCount, warnDays, limitDays, viewCount,
}: {
  s: Student; classId: string; canDelete: boolean; index: number
  absenceCount: number; warnDays: number; limitDays: number; viewCount: number
}) {
```

`OgrenciSatiri`'nde öğrenci adı `<Link>` satırının hemen yanına badge ekle:
```tsx
{viewCount > 0 && (
  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700 shrink-0">
    👁 {viewCount}
  </span>
)}
```

`OgrenciListesi` içindeki `OgrenciSatiri` render çağrısına prop geç:
```tsx
viewCount={viewCounts?.[s.id] ?? 0}
```

- [ ] **Step 4: siniflar/[id]/page.tsx — viewCounts query + OgrenciListesi prop**

Import ekle:
```ts
import { VeliAnalyticsRepository } from '@/src/domains/classes/repositories/VeliAnalyticsRepository'
```

Mevcut `Promise.all` içine viewCounts sorgusunu ekle:
```ts
const [clsResult, studentsResult, absenceResult, viewCountsResult] = await Promise.all([
  // ...mevcut sorgular...
  VeliAnalyticsRepository.getVeliViewCounts(id, schoolId),
])
```

`OgrenciListesi`'ne prop geç:
```tsx
<OgrenciListesi
  // ...mevcut props...
  viewCounts={viewCountsResult}
/>
```

- [ ] **Step 5: tsc kontrol**

```bash
npx tsc --noEmit
```

Beklenen: 0 hata

- [ ] **Step 6: Commit**

```bash
git add "app/(dashboard)/siniflar/[id]/ogrenciler/[studentId]/VeliAnalyticsCard.tsx" "app/(dashboard)/siniflar/[id]/ogrenciler/[studentId]/page.tsx" "app/(dashboard)/siniflar/[id]/OgrenciListesi.tsx" "app/(dashboard)/siniflar/[id]/page.tsx"
git commit -m "feat(veli): analytics card + view count badge"
```

---

### Task 9: Build, Test ve Push

**Files:** (doğrulama)

- [ ] **Step 1: Tüm testleri çalıştır**

```bash
npm run test -- --reporter=dot
```

Beklenen: 699+ test, 0 fail (694 mevcut + 5 yeni veli-portal testi)

- [ ] **Step 2: Production build al**

```bash
npm run build
```

Beklenen: başarılı build, 0 hata

- [ ] **Step 3: Final commit ve push**

```bash
git push origin main
```
