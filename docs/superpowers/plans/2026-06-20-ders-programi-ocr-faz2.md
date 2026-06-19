# Ders Programı OCR (Faz 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Öğretmen ders programı görüntüsü (foto veya ekran görüntüsü) yükleyip `/ders-programi` ızgarasını otomatik ön-doldurabilsin; sonra düzeltip mevcut "Kaydet" ile yazsın.

**Architecture:** Vision LLM (Vercel AI Gateway + Gemini Flash) görüntüden yalnız `slots` çıkarır. Saf bir eşleştirme modülü (`ocrPrompt.ts`) model çıktısındaki sınıf isimlerini normalize edip okulun `class_id`'lerine eşler; eşleşmeyen hücre boş kalır. Server action senkron çalışır, ızgaranın client state'ini doldurur — kaydetme yine faz 1'in `saveSchedule` doğrulamasından (Zod + `validateSlots` + cross-tenant) geçer.

**Tech Stack:** Next.js App Router (bu repoda middleware = `proxy.ts`), React 19, TypeScript, Supabase SSR, `ai` paketi (AI Gateway provider built-in), Vitest.

## Global Constraints

- OCR yalnız **`slots`** çıkarır; **`periods` (zil saatleri) OCR'a dahil DEĞİL** (faz 1 `DEFAULT_PERIODS` + öğretmen düzenler).
- Girdi görüntüsü ve ham OCR metni **saklanmaz/persist edilmez** (`file_url/file_name` boş kalır; loglara görüntü içeriği yazılmaz).
- Sınıf eşleştirme **yalnız normalize edilmiş isim → class_id**; eşleşme yoksa hücre **boş** kalır. Asla `class_id` uydurulmaz/tahmin edilmez.
- Model ID **ezberden/bellekten YAZILMAZ.** Impl sırasında canlı listeden çözülür: `curl -s https://ai-gateway.vercel.sh/v1/models | jq -r '[.data[] | select(.id|startswith("google/")) | .id] | reverse | .[]'` → en güncel `*-flash`.
- Son kapı faz 1: `saveSchedule` → Zod + `validateSlots` + cross-tenant kontrolü. OCR bunları bypass etmez.
- Yetki/çok-kiracılılık: sınıf listesi yalnız çağıranın `school_id`'sine göre çekilir (`requireAbility()`, faz 1 deseni).
- Kod konvansiyonları (CLAUDE.md): `repositories → services → actions`; `deleted_at IS NULL` filtresi; `revalidatePath` mutasyondan sonra (OCR mutasyon değil → revalidate yok).

**Mevcut faz 1 imzaları (değişmez, tüketilir):**
- `type Slot = { day: number; period: number; class_id: string }` — `src/domains/schedule/scheduleMath.ts`
- `type Period = { no: number; start: string; end: string }`
- `validateSlots(slots: Slot[], periods: Period[], validClassIds: string[]): string | null`
- `requireAbility(): Promise<Ability>` (`.userId`, `.schoolId`) — `src/shared/authorization/server`
- `ScheduleRepository.listSchoolClasses(schoolId): Promise<{ data: {id:string;name:string}[] | null; error: ... }>`
- `type ActionResult<T extends object = object> = { error?: string } & T` — `src/shared/types/index`
- `logger` — `@/src/infrastructure/observability/logger` (`logger.error({...}, 'mesaj')`)

---

## File Structure

- **Create** `src/domains/schedule/ocrPrompt.ts` — SAF: `OcrCell` tipi, `normalizeClassName`, `buildOcrPrompt`, `parseOcrResult`. DB/AI yok. Tüm eşleştirme mantığı burada.
- **Create** `tests/vitest/unit/domains/schedule/ocrPrompt.test.ts` — birim testler.
- **Modify** `src/domains/schedule/services/ScheduleService.ts` — `ocrFromImage(image)` metodu ekle (AI Gateway çağrısı + parse).
- **Modify** `app/actions/schedule.ts` — `ocrSchedule(formData: FormData)` action ekle.
- **Modify** `app/(dashboard)/ders-programi/DersProgramiClient.tsx` — "Fotoğraftan doldur" butonu + sonucu ızgaraya uygula.
- **Modify** `package.json` — `ai` bağımlılığı.
- **Env** `.env.local` (+ Vercel proje env) — `AI_GATEWAY_API_KEY`.

---

## Task 1: `ai` paketi + AI Gateway erişimi ve model ID çözümü

**Files:**
- Modify: `package.json`
- Env: `.env.local`

**Interfaces:**
- Produces: kurulu `ai` paketi; doğrulanmış `AI_GATEWAY_API_KEY`; seçilmiş Gemini Flash model ID (sonraki task'larda `ScheduleService` kullanır).

- [ ] **Step 1: `ai` paketini kur**

```bash
npm install ai
```

- [ ] **Step 2: Canlı model listesinden Gemini Flash ID'sini çöz**

Run:
```bash
curl -s https://ai-gateway.vercel.sh/v1/models | jq -r '[.data[] | select(.id|startswith("google/")) | .id] | reverse | .[]'
```
Expected: `google/...flash...` ile başlayan ID'ler listelenir. En güncel `flash` sürümünü not al (örn. listenin başındaki en yüksek versiyon). Bu ID Task 3'te kullanılacak — **bu plana sabit yazma, çözdüğün değeri kullan.**

- [ ] **Step 3: Env anahtarını ekle**

`.env.local` dosyasına ekle (değer Vercel AI Gateway'den alınır):
```
AI_GATEWAY_API_KEY=...
```
Vercel proje env'ine de eklenmeli (deploy için): `npx vercel env add AI_GATEWAY_API_KEY` veya dashboard.

- [ ] **Step 4: Erişimi geçici smoke ile doğrula**

Geçici dosya `tmp-ai-smoke.mjs` oluştur (model ID = Step 2'de çözdüğün değer):
```js
import { generateText } from 'ai'
const { text } = await generateText({
  model: 'google/REPLACE_WITH_RESOLVED_FLASH_ID',
  prompt: 'Tek kelime yanıt ver: merhaba',
})
console.log('OK:', text)
```
Run: `node tmp-ai-smoke.mjs`
Expected: `OK: ...` yazısı (hata değil). Başarısızsa anahtarı/model ID'sini düzelt.

- [ ] **Step 5: Smoke dosyasını sil ve commit et**

```bash
rm tmp-ai-smoke.mjs
git add package.json package-lock.json
git commit -m "chore(schedule): AI SDK (ai) ekle — OCR faz 2 için AI Gateway erişimi"
```
> Not: `.env.local` git-ignored; commit edilmez.

---

## Task 2: `ocrPrompt.ts` — saf prompt üretimi + eşleştirme parser (TDD)

**Files:**
- Create: `src/domains/schedule/ocrPrompt.ts`
- Test: `tests/vitest/unit/domains/schedule/ocrPrompt.test.ts`

**Interfaces:**
- Consumes: `type Slot` from `./scheduleMath`.
- Produces:
  - `interface OcrCell { day: number; period: number; class: string }`
  - `normalizeClassName(name: string): string`
  - `buildOcrPrompt(classNames: string[]): string`
  - `parseOcrResult(cells: OcrCell[], classes: { id: string; name: string }[]): Slot[]`

- [ ] **Step 1: Failing testleri yaz**

Create `tests/vitest/unit/domains/schedule/ocrPrompt.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { normalizeClassName, buildOcrPrompt, parseOcrResult, type OcrCell } from '@/src/domains/schedule/ocrPrompt'

const CLASSES = [
  { id: 'id-9a', name: '9-A' },
  { id: 'id-10b', name: '10-B' },
]

describe('normalizeClassName', () => {
  it('boşluk, ayraç ve büyük/küçük harf farkını yok sayar', () => {
    expect(normalizeClassName('9 / A')).toBe(normalizeClassName('9-A'))
    expect(normalizeClassName('9a')).toBe(normalizeClassName('9-A'))
    expect(normalizeClassName('10 B')).toBe(normalizeClassName('10-b'))
  })
})

describe('buildOcrPrompt', () => {
  it('sınıf isimlerini ve gün/periyot çerçevesini içerir', () => {
    const p = buildOcrPrompt(['9-A', '10-B'])
    expect(p).toContain('9-A')
    expect(p).toContain('10-B')
    expect(p).toMatch(/1.*5|Pazartesi|day/i) // gün aralığı tarifi
  })
})

describe('parseOcrResult', () => {
  it('exact isimle class_id eşler', () => {
    const cells: OcrCell[] = [{ day: 1, period: 1, class: '9-A' }]
    expect(parseOcrResult(cells, CLASSES)).toEqual([{ day: 1, period: 1, class_id: 'id-9a' }])
  })
  it('normalize edilmiş isimle eşler', () => {
    const cells: OcrCell[] = [{ day: 2, period: 3, class: '10 / b' }]
    expect(parseOcrResult(cells, CLASSES)).toEqual([{ day: 2, period: 3, class_id: 'id-10b' }])
  })
  it('listede olmayan ismi düşürür (boş bırakır)', () => {
    const cells: OcrCell[] = [{ day: 1, period: 1, class: '11-Z' }]
    expect(parseOcrResult(cells, CLASSES)).toEqual([])
  })
  it('aynı (gün,periyot) çiftini teke indirir', () => {
    const cells: OcrCell[] = [
      { day: 1, period: 1, class: '9-A' },
      { day: 1, period: 1, class: '10-B' },
    ]
    expect(parseOcrResult(cells, CLASSES)).toEqual([{ day: 1, period: 1, class_id: 'id-9a' }])
  })
  it('aralık dışı gün/periyodu düşürür', () => {
    const cells: OcrCell[] = [
      { day: 0, period: 1, class: '9-A' },
      { day: 1, period: 99, class: '9-A' },
      { day: 6, period: 1, class: '10-B' },
    ]
    expect(parseOcrResult(cells, CLASSES)).toEqual([])
  })
  it('boş/bozuk girdide güvenli boş döner', () => {
    expect(parseOcrResult([], CLASSES)).toEqual([])
    // @ts-expect-error bozuk cell
    expect(parseOcrResult([{ day: 1 }], CLASSES)).toEqual([])
  })
})
```

- [ ] **Step 2: Testlerin başarısız olduğunu doğrula**

Run: `npx vitest run tests/vitest/unit/domains/schedule/ocrPrompt.test.ts`
Expected: FAIL — `ocrPrompt` modülü bulunamadı.

- [ ] **Step 3: `ocrPrompt.ts`'i yaz**

Create `src/domains/schedule/ocrPrompt.ts`:
```ts
import type { Slot } from './scheduleMath'

// Modelden beklenen ham hücre (yalnız DOLU hücreler döner).
export interface OcrCell { day: number; period: number; class: string }

// "9 / A" ≡ "9-A" ≡ "9a" — küçük harf, harf-dışı/rakam-dışı ayraçları sök.
export function normalizeClassName(name: string): string {
  return String(name ?? '').toLowerCase().replace(/[^a-z0-9çğıöşü]/gi, '')
}

const DAY_NAMES = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma']

// Görüntüden slot çıkarımı için talimat. Modelden yalnız verilen sınıf
// isimlerinden birini ya da hiç döndürmemesi istenir.
export function buildOcrPrompt(classNames: string[]): string {
  const list = classNames.map(n => `"${n}"`).join(', ')
  return [
    'Bu bir okul haftalık ders programı görüntüsü. Her dolu hücredeki sınıfı çıkar.',
    `Günler: 1=Pazartesi … 5=Cuma (${DAY_NAMES.join(', ')}). Hafta sonu yok.`,
    'period = soldaki ders sırası (1. ders = 1, 2. ders = 2, …).',
    `Sınıf adı YALNIZCA şu listeden olmalı: [${list}].`,
    'Listeyle eşleşmeyen, boş veya emin olmadığın hücreyi DÖNDÜRME (atla).',
    'Sadece dolu hücreleri döndür. Saatleri/zil çizelgesini çıkarma.',
  ].join('\n')
}

// Ham hücreleri okulun class_id'lerine eşler. Eşleşmeyen/aralık-dışı/çift
// hücreler düşürülür — asla class_id uydurulmaz.
export function parseOcrResult(cells: OcrCell[], classes: { id: string; name: string }[]): Slot[] {
  const byNorm = new Map(classes.map(c => [normalizeClassName(c.name), c.id]))
  const seen = new Set<string>()
  const out: Slot[] = []
  for (const c of Array.isArray(cells) ? cells : []) {
    if (!c || typeof c.day !== 'number' || typeof c.period !== 'number' || typeof c.class !== 'string') continue
    if (c.day < 1 || c.day > 5) continue
    if (!Number.isInteger(c.period) || c.period < 1 || c.period > 12) continue
    const id = byNorm.get(normalizeClassName(c.class))
    if (!id) continue
    const key = `${c.day}-${c.period}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ day: c.day, period: c.period, class_id: id })
  }
  return out
}
```

- [ ] **Step 4: Testlerin geçtiğini doğrula**

Run: `npx vitest run tests/vitest/unit/domains/schedule/ocrPrompt.test.ts`
Expected: PASS (tüm testler).

- [ ] **Step 5: Commit**

```bash
git add src/domains/schedule/ocrPrompt.ts tests/vitest/unit/domains/schedule/ocrPrompt.test.ts
git commit -m "feat(schedule): OCR prompt üretimi + sınıf eşleştirme parser (saf, test)"
```

---

## Task 3: `ScheduleService.ocrFromImage` — AI Gateway çağrısı + parse

**Files:**
- Modify: `src/domains/schedule/services/ScheduleService.ts`

**Interfaces:**
- Consumes: `buildOcrPrompt`, `parseOcrResult`, `type OcrCell` (Task 2); `requireAbility`, `ScheduleRepository.listSchoolClasses`, `logger`, `generateObject` from `ai`, `z`.
- Produces: `ScheduleService.ocrFromImage(image: { data: Uint8Array; mediaType: string }): Promise<{ slots?: Slot[]; error?: string }>`

- [ ] **Step 1: Import'ları ve metodu ekle**

`src/domains/schedule/services/ScheduleService.ts` üst importlarına ekle:
```ts
import { generateObject } from 'ai'
import { z } from 'zod'
import { buildOcrPrompt, parseOcrResult } from '../ocrPrompt'
```
`ScheduleService` nesnesine (kapanış `}` öncesi) yeni metot ekle. **`MODEL` değerini Task 1 Step 2'de çözdüğün gerçek flash ID ile değiştir:**
```ts
  async ocrFromImage(image: { data: Uint8Array; mediaType: string }): Promise<{ slots?: Slot[]; error?: string }> {
    const ability = await requireAbility()
    const { data: classes, error: classErr } = await ScheduleRepository.listSchoolClasses(ability.schoolId)
    if (classErr) {
      logger.error({ event: 'ocr_class_read_failed', userId: ability.userId, err: classErr.message }, 'OCR sınıf listesi okunamadı')
      return { error: 'Sınıf listesi alınamadı' }
    }
    const list = (classes ?? []) as { id: string; name: string }[]
    if (list.length === 0) return { error: 'Okulda kayıtlı sınıf yok' }

    const cellSchema = z.object({ day: z.number(), period: z.number(), class: z.string() })
    try {
      const { object } = await generateObject({
        model: 'google/RESOLVED_FLASH_ID', // Task 1 Step 2'den
        schema: z.object({ cells: z.array(cellSchema) }),
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: buildOcrPrompt(list.map(c => c.name)) },
              { type: 'image', image: image.data, mediaType: image.mediaType },
            ],
          },
        ],
      })
      const slots = parseOcrResult(object.cells as { day: number; period: number; class: string }[], list)
      return { slots }
    } catch (e) {
      logger.error({ event: 'ocr_inference_failed', userId: ability.userId, err: (e as Error).message }, 'OCR çıkarımı başarısız')
      return { error: 'Görüntü okunamadı, ızgarayı elle doldurabilirsiniz' }
    }
  },
```
> `generateObject` + `messages`/`image` API'sini impl sırasında `node_modules/ai/docs/`'tan doğrula (image part alan adı `image` ve `mediaType`; sürüm farkı olursa docs'a göre uyarla).

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: Hata yok. (`generateObject` image/mediaType alan adlarında type hatası alırsan `node_modules/ai/docs/` ve `node_modules/ai/src/`'tan doğru alanları bul.)

- [ ] **Step 3: Commit**

```bash
git add src/domains/schedule/services/ScheduleService.ts
git commit -m "feat(schedule): ocrFromImage — AI Gateway vision ile slot çıkarımı"
```

---

## Task 4: `ocrSchedule` server action — dosya doğrulama + service

**Files:**
- Modify: `app/actions/schedule.ts`

**Interfaces:**
- Consumes: `ScheduleService.ocrFromImage` (Task 3); `type Slot`; `ActionResult`.
- Produces: `ocrSchedule(formData: FormData): Promise<ActionResult<{ slots?: Slot[] }>>`

- [ ] **Step 1: Action'ı ekle**

`app/actions/schedule.ts` sonuna ekle (üst importa `Slot` tipini de getir):
```ts
import type { Slot } from '@/src/domains/schedule/scheduleMath'

const MAX_BYTES = 8 * 1024 * 1024 // 8MB

export async function ocrSchedule(formData: FormData): Promise<ActionResult<{ slots?: Slot[] }>> {
  const file = formData.get('image')
  if (!(file instanceof File)) return { error: 'Görüntü bulunamadı' }
  if (!file.type.startsWith('image/')) return { error: 'Yalnız görüntü dosyası yüklenebilir' }
  if (file.size === 0) return { error: 'Boş dosya' }
  if (file.size > MAX_BYTES) return { error: 'Görüntü çok büyük (en fazla 8MB)' }

  const data = new Uint8Array(await file.arrayBuffer())
  const res = await ScheduleService.ocrFromImage({ data, mediaType: file.type })
  if (res.error) return { error: res.error }
  return { slots: res.slots }
}
```
> OCR mutasyon değil → `revalidatePath` YOK. Görüntü saklanmaz; yalnız bellekte işlenir.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: Hata yok.

- [ ] **Step 3: Commit**

```bash
git add app/actions/schedule.ts
git commit -m "feat(schedule): ocrSchedule action — görüntü doğrulama + slot çıkarımı"
```

---

## Task 5: `DersProgramiClient` — "Fotoğraftan doldur" butonu + uygula

**Files:**
- Modify: `app/(dashboard)/ders-programi/DersProgramiClient.tsx`

**Interfaces:**
- Consumes: `ocrSchedule` (Task 4); mevcut `setSlots`, `setMsg`, `pending/startTransition`.
- Produces: UI — gizli `<input type="file">` + buton; sonuç `slots`'u ızgaraya uygular.

- [ ] **Step 1: Import + ref + handler ekle**

Üstte import'a ekle:
```ts
import { useRef } from 'react'
import { saveSchedule, ocrSchedule } from '@/app/actions/schedule'
```
Bileşen gövdesinde (state'lerin yanına) ekle:
```ts
  const fileRef = useRef<HTMLInputElement>(null)

  function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // aynı dosya tekrar seçilebilsin
    if (!file) return
    setMsg(null)
    const fd = new FormData()
    fd.append('image', file)
    startTransition(async () => {
      const res = await ocrSchedule(fd)
      if (res.error) { setMsg({ text: res.error }); return }
      const found = res.slots ?? []
      setSlots(found)
      setMsg({ ok: true, text: `${found.length} ders bulundu. Lütfen kontrol edip kaydedin.` })
    })
  }
```
> `setSlots(found)` ızgarayı OCR sonucuyla **değiştirir** (ön-doldurma). Öğretmen düzeltip "Kaydet"e basana kadar DB'ye yazılmaz.

- [ ] **Step 2: Butonu + gizli input'u ekle**

"Zil saatlerini düzenle" butonunun hemen öncesine, buton grubunun içine ekle:
```tsx
          <input ref={fileRef} type="file" accept="image/*" onChange={onPickImage} className="hidden" />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={pending || classes.length === 0}
            className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 dark:border-slate-600 text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 disabled:opacity-50"
          >
            {pending ? 'Okunuyor…' : 'Fotoğraftan doldur'}
          </button>
```

- [ ] **Step 3: Typecheck + build**

Run: `npx tsc --noEmit`
Expected: Hata yok.

- [ ] **Step 4: Commit**

```bash
git add "app/(dashboard)/ders-programi/DersProgramiClient.tsx"
git commit -m "feat(schedule): Fotoğraftan doldur butonu — OCR sonucunu ızgaraya uygula"
```

---

## Task 6: Uçtan uca manuel doğrulama

**Files:** (yok — manuel test)

- [ ] **Step 1: Tüm birim testleri + typecheck**

Run: `npm run test:unit && npx tsc --noEmit`
Expected: Tümü PASS, tip hatası yok.

- [ ] **Step 2: Dev sunucu + gerçek görüntü denemesi**

Run: `npm run dev`
Öğretmen olarak giriş yap → `/ders-programi` → "Fotoğraftan doldur" → gerçek bir program görüntüsü (hem net ekran görüntüsü hem telefon fotoğrafı) seç.
Beklenen:
- Izgara tanınan derslerle dolar; tanınmayan/listede olmayan hücreler boş kalır.
- "N ders bulundu" mesajı görünür.
- Düzeltip "Kaydet" → faz 1 doğrulamasından geçer, sayfa yenilemede kalıcı.
- Bozuk/alakasız görüntü → "Görüntü okunamadı…" mesajı, ızgara bozulmaz.

- [ ] **Step 3: Smoke sonrası temizlik kontrolü**

`.env.local` commit edilmediğini doğrula (`git status` temiz olmalı, `tmp-ai-smoke.mjs` yok).

---

## Self-Review (yazım sonrası)

- **Spec coverage:** Girdi (foto+screenshot) → Task 5 input `accept="image/*"`; Model/Gateway/canlı-ID → Task 1 + Task 3; yalnız-slots → Global Constraints + Task 2/3 (periods yok); görüntü saklanmaz → Task 4 (revalidate/persist yok) + Global Constraints; eşleştirme normalize/eşleşmeyen-boş/uydurma-yok → Task 2 `parseOcrResult`; son kapı faz 1 → Task 5 (setSlots + mevcut saveSchedule), Global Constraints. ✓ Gap yok.
- **Placeholder scan:** Model ID kasıtlı `RESOLVED_FLASH_ID` (canlı çözülür, hata-önleme); başka TODO/TBD yok. ✓
- **Type consistency:** `Slot{day,period,class_id}`, `OcrCell{day,period,class}`, `ocrFromImage({data,mediaType})`, `ocrSchedule(FormData)→ActionResult<{slots?}>` task'lar arası tutarlı. ✓
