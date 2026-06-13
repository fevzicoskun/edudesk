# Demo Player Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/demo` sayfasında EduDesk özelliklerini video benzeri interaktif tur olarak gösteren bir player — animasyonlu cursor, click ripple, highlight kutuları, chapter navigasyonu ve progress bar.

**Architecture:** `scenes.ts` saf veri katmanı + `DemoPlayer.tsx` tek client component + pure fonksiyonlar test edilir. Yeni bağımlılık yok.

**Tech Stack:** Next.js App Router, React 19, Tailwind v4, Vitest

---

## Task 1: Public Route + Placeholder Klasörü

**Files:**
- Modify: `proxy.ts:5`
- Create: `public/demo/README.md`

- [ ] **proxy.ts `PUBLIC_PATHS`'e `/demo` ekle**

```typescript
// proxy.ts satır 5 — mevcut dizi:
const PUBLIC_PATHS = ['/', '/login', '/kayit', '/veli', '/yoklama-yazdir', '/onboarding', '/api/inngest', '/gizlilik', '/kullanim-kosullari', '/sifremi-unuttum', '/auth/callback']

// Şu hale getir:
const PUBLIC_PATHS = ['/', '/login', '/kayit', '/veli', '/yoklama-yazdir', '/onboarding', '/api/inngest', '/gizlilik', '/kullanim-kosullari', '/sifremi-unuttum', '/auth/callback', '/demo']
```

- [ ] **`public/demo/README.md` oluştur**

```markdown
# Demo Screenshots

Bu klasöre aşağıdaki isimlerde 1280×720 (veya 1920×1080) PNG dosyaları koy:

- screenshot-01-dashboard.png
- screenshot-02-odev-olustur.png
- screenshot-03-odev-durum.png
- screenshot-04-matris.png
- screenshot-05-yoklama.png
- screenshot-06-cizelge.png
- screenshot-07-devamsizlik-raporu.png
- screenshot-08-veli.png

Dosya yoksa player otomatik olarak renkli placeholder gösterir.
```

- [ ] **Commit**

```bash
git add proxy.ts public/demo/README.md
git commit -m "feat(demo): add /demo to PUBLIC_PATHS, add screenshot placeholder README"
```

---

## Task 2: Sahne Verisi + Pure Fonksiyonlar

**Files:**
- Create: `app/demo/scenes.ts`

- [ ] **`app/demo/scenes.ts` oluştur**

```typescript
export type CursorStep = {
  x: number
  y: number
  delay: number
}

export type ClickEffect = {
  x: number
  y: number
  delay: number
}

export type HighlightBox = {
  x: number
  y: number
  width: number
  height: number
  label?: string
  delay?: number
}

export type Scene = {
  id: string
  chapter: string
  screenshot: string
  duration: number
  caption: string
  cursorPath?: CursorStep[]
  clicks?: ClickEffect[]
  highlights?: HighlightBox[]
}

export const scenes: Scene[] = [
  {
    id: 'dashboard',
    chapter: 'Genel Bakış',
    screenshot: 'screenshot-01-dashboard.png',
    duration: 4000,
    caption: 'Müdür genel bakış ekranı — bugünkü yoklama durumu, ödev girişleri ve öğretmen aktivitesi tek ekranda.',
    highlights: [
      { x: 5, y: 15, width: 30, height: 20, label: 'Risk uyarıları', delay: 1000 },
      { x: 40, y: 15, width: 55, height: 20, label: 'Öğretmen aktivitesi', delay: 2500 },
    ],
  },
  {
    id: 'odev-olustur',
    chapter: 'Ödev Takibi',
    screenshot: 'screenshot-02-odev-olustur.png',
    duration: 5000,
    caption: 'Tek seferde birden fazla sınıfa ödev atayın — başlık, açıklama ve teslim tarihi belirleyin.',
    cursorPath: [
      { x: 85, y: 8, delay: 500 },
      { x: 85, y: 8, delay: 1200 },
    ],
    clicks: [{ x: 85, y: 8, delay: 1200 }],
    highlights: [
      { x: 60, y: 40, width: 35, height: 40, label: 'Çoklu sınıf seçimi', delay: 2500 },
    ],
  },
  {
    id: 'odev-durum',
    chapter: 'Ödev Takibi',
    screenshot: 'screenshot-03-odev-durum.png',
    duration: 5000,
    caption: 'Her öğrencinin ödev durumunu 5 seçenekten biriyle işaretleyin: yapıldı, eksik, yapılmadı, geç, mazeretli.',
    cursorPath: [
      { x: 20, y: 35, delay: 500 },
      { x: 20, y: 50, delay: 1500 },
      { x: 20, y: 65, delay: 2500 },
    ],
    highlights: [
      { x: 5, y: 30, width: 90, height: 50, label: 'Anlık durum güncelleme', delay: 3500 },
    ],
  },
  {
    id: 'sinif-matrisi',
    chapter: 'Sınıf Matrisi',
    screenshot: 'screenshot-04-matris.png',
    duration: 4500,
    caption: 'Tüm öğrenciler × tüm ödevler matris görünümü — tamamlanma yüzdesi satır ve sütun bazlı.',
    highlights: [
      { x: 0, y: 10, width: 100, height: 70, label: 'Öğrenci × Ödev matrisi', delay: 800 },
      { x: 0, y: 80, width: 100, height: 15, label: 'Sütun tamamlanma %', delay: 2500 },
    ],
  },
  {
    id: 'yoklama',
    chapter: 'Yoklama',
    screenshot: 'screenshot-05-yoklama.png',
    duration: 5000,
    caption: 'Günlük yoklama: mevcut, devamsız, geç veya özürlü. Toplu işlemler ve kaydedilmemiş değişiklik koruması.',
    cursorPath: [
      { x: 50, y: 40, delay: 500 },
      { x: 50, y: 55, delay: 1500 },
    ],
    clicks: [{ x: 50, y: 40, delay: 1200 }],
    highlights: [
      { x: 5, y: 5, width: 90, height: 15, label: 'Toplu güncelleme butonları', delay: 2500 },
    ],
  },
  {
    id: 'cizelge',
    chapter: 'Yoklama',
    screenshot: 'screenshot-06-cizelge.png',
    duration: 4000,
    caption: 'Aylık çizelge — gün adları, bugün vurgusu ve MEB devamsızlık eşiği renklendirmesi.',
    highlights: [
      { x: 5, y: 20, width: 90, height: 60, label: 'Aylık devamsızlık çizelgesi', delay: 800 },
    ],
  },
  {
    id: 'devamsizlik-raporu',
    chapter: 'Müdür Paneli',
    screenshot: 'screenshot-07-devamsizlik-raporu.png',
    duration: 4500,
    caption: 'Müdür raporu — MEB sınırına (15/20 gün) yaklaşan öğrenciler risk sırasına göre listelenir. Excel export.',
    highlights: [
      { x: 5, y: 5, width: 90, height: 20, label: 'Tehlike / Uyarı / Takip özet kartları', delay: 800 },
      { x: 5, y: 30, width: 90, height: 55, label: 'Risk sıralı öğrenci listesi', delay: 2000 },
    ],
  },
  {
    id: 'veli-portal',
    chapter: 'Veli Portalı',
    screenshot: 'screenshot-08-veli.png',
    duration: 4000,
    caption: 'Veli portalı — veliler çocuklarının ödev geçmişini ve devamsızlık grafiğini görebilir.',
    highlights: [
      { x: 5, y: 10, width: 45, height: 35, label: 'Dönem özeti', delay: 800 },
      { x: 55, y: 10, width: 40, height: 35, label: 'Devamsızlık grafiği', delay: 2000 },
    ],
  },
]

// ─── Pure Engine Functions ──────────────────────────────────────────

export function getCursorPos(
  path: CursorStep[],
  elapsed: number
): { x: number; y: number } | null {
  if (!path.length) return null
  const active = path.filter(s => s.delay <= elapsed)
  if (!active.length) return null
  const prev = active[active.length - 1]
  const next = path.find(s => s.delay > elapsed)
  if (!next) return { x: prev.x, y: prev.y }
  const t = (elapsed - prev.delay) / (next.delay - prev.delay)
  return { x: prev.x + (next.x - prev.x) * t, y: prev.y + (next.y - prev.y) * t }
}

export function getTotalProgress(
  sceneList: Scene[],
  sceneIdx: number,
  elapsed: number
): number {
  const total = sceneList.reduce((s, sc) => s + sc.duration, 0)
  if (total === 0) return 0
  const done = sceneList.slice(0, sceneIdx).reduce((s, sc) => s + sc.duration, 0)
  return Math.min(1, (done + elapsed) / total)
}

export function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}

export function getTotalDuration(sceneList: Scene[]): number {
  return sceneList.reduce((s, sc) => s + sc.duration, 0)
}

export function seekToRatio(
  sceneList: Scene[],
  ratio: number
): { sceneIdx: number; elapsed: number } {
  const total = getTotalDuration(sceneList)
  const target = Math.min(ratio * total, total - 1)
  let acc = 0
  for (let i = 0; i < sceneList.length; i++) {
    if (acc + sceneList[i].duration > target) {
      return { sceneIdx: i, elapsed: target - acc }
    }
    acc += sceneList[i].duration
  }
  return { sceneIdx: sceneList.length - 1, elapsed: sceneList[sceneList.length - 1].duration }
}
```

- [ ] **Commit**

```bash
git add app/demo/scenes.ts
git commit -m "feat(demo): add scene data and pure engine functions"
```

---

## Task 3: Pure Fonksiyon Testleri

**Files:**
- Create: `tests/vitest/unit/demo/demoEngine.test.ts`

- [ ] **Test dosyasını yaz**

```typescript
import { describe, it, expect } from 'vitest'
import { getCursorPos, getTotalProgress, formatTime, seekToRatio } from '@/app/demo/scenes'
import type { Scene, CursorStep } from '@/app/demo/scenes'

const makeScene = (duration: number): Scene => ({
  id: 'test', chapter: 'Test', screenshot: 'test.png', duration, caption: 'test',
})

describe('getCursorPos', () => {
  it('boş path → null döner', () => {
    expect(getCursorPos([], 1000)).toBeNull()
  })

  it('elapsed ilk stepten küçükse null döner', () => {
    const path: CursorStep[] = [{ x: 50, y: 50, delay: 1000 }]
    expect(getCursorPos(path, 500)).toBeNull()
  })

  it('elapsed iki step arasında → doğru interpolasyon', () => {
    const path: CursorStep[] = [
      { x: 0,   y: 0,   delay: 0 },
      { x: 100, y: 100, delay: 1000 },
    ]
    const pos = getCursorPos(path, 500)
    expect(pos).not.toBeNull()
    expect(pos!.x).toBeCloseTo(50)
    expect(pos!.y).toBeCloseTo(50)
  })

  it('elapsed son stepten büyük → son step pozisyonu', () => {
    const path: CursorStep[] = [
      { x: 10, y: 20, delay: 0 },
      { x: 80, y: 90, delay: 1000 },
    ]
    const pos = getCursorPos(path, 2000)
    expect(pos).toEqual({ x: 80, y: 90 })
  })
})

describe('getTotalProgress', () => {
  const sceneList = [makeScene(2000), makeScene(3000), makeScene(1000)]

  it('sceneIdx=0, elapsed=0 → 0', () => {
    expect(getTotalProgress(sceneList, 0, 0)).toBe(0)
  })

  it('son sahne bitti → 1', () => {
    expect(getTotalProgress(sceneList, 2, 1000)).toBe(1)
  })

  it('orta sahne orta elapsed → doğru oran', () => {
    // toplam = 6000, sahne 0 geçti (2000), sahne 1'de 1500ms
    // (2000 + 1500) / 6000 = 3500/6000 ≈ 0.5833
    const p = getTotalProgress(sceneList, 1, 1500)
    expect(p).toBeCloseTo(3500 / 6000)
  })

  it('boş liste → 0', () => {
    expect(getTotalProgress([], 0, 0)).toBe(0)
  })
})

describe('formatTime', () => {
  it('0ms → "0:00"', () => expect(formatTime(0)).toBe('0:00'))
  it('65000ms → "1:05"', () => expect(formatTime(65000)).toBe('1:05'))
  it('3600000ms → "60:00"', () => expect(formatTime(3600000)).toBe('60:00'))
})

describe('seekToRatio', () => {
  const sceneList = [makeScene(2000), makeScene(3000), makeScene(1000)]

  it('ratio=0 → scene 0, elapsed 0', () => {
    expect(seekToRatio(sceneList, 0)).toEqual({ sceneIdx: 0, elapsed: 0 })
  })

  it('ratio=0.5 → sahne 1 içinde', () => {
    // 0.5 * 6000 = 3000ms; sahne 0 = 2000ms geçer, sahne 1'de 1000ms
    const r = seekToRatio(sceneList, 0.5)
    expect(r.sceneIdx).toBe(1)
    expect(r.elapsed).toBeCloseTo(1000)
  })
})
```

- [ ] **Testleri çalıştır — geçmeli**

```bash
npx vitest run tests/vitest/unit/demo/demoEngine.test.ts
```

Beklenen: 11/11 yeşil

- [ ] **Commit**

```bash
git add tests/vitest/unit/demo/demoEngine.test.ts
git commit -m "test(demo): add engine pure function tests"
```

---

## Task 4: DemoPlayer Client Component

**Files:**
- Create: `app/demo/DemoPlayer.tsx`

- [ ] **`app/demo/DemoPlayer.tsx` oluştur**

```tsx
'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  scenes,
  getCursorPos,
  getTotalProgress,
  getTotalDuration,
  formatTime,
  seekToRatio,
} from './scenes'

const TICK_MS = 16

export default function DemoPlayer() {
  const [sceneIdx, setSceneIdx]   = useState(0)
  const [elapsed, setElapsed]     = useState(0)
  const [playing, setPlaying]     = useState(true)
  const [imgError, setImgError]   = useState(false)
  const [activeClicks, setActiveClicks] = useState<{ id: number; x: number; y: number }[]>([])
  const clickIdRef = useRef(0)
  const prevClicksRef = useRef<Set<number>>(new Set())

  const scene      = scenes[sceneIdx]
  const progress   = getTotalProgress(scenes, sceneIdx, elapsed)
  const totalMs    = getTotalDuration(scenes)
  const doneMs     = scenes.slice(0, sceneIdx).reduce((s, sc) => s + sc.duration, 0)
  const isFinished = sceneIdx === scenes.length - 1 && elapsed >= scene.duration

  // Reset imgError on scene change
  useEffect(() => { setImgError(false) }, [sceneIdx])

  // Tick
  useEffect(() => {
    if (!playing || isFinished) return
    const id = setInterval(() => {
      setElapsed(e => {
        const next = e + TICK_MS
        if (next >= scenes[sceneIdx].duration) {
          if (sceneIdx < scenes.length - 1) {
            setSceneIdx(i => i + 1)
            prevClicksRef.current = new Set()
            return 0
          }
          setPlaying(false)
          return scenes[sceneIdx].duration
        }
        return next
      })
    }, TICK_MS)
    return () => clearInterval(id)
  }, [playing, sceneIdx, isFinished])

  // Click ripple trigger
  useEffect(() => {
    if (!scene.clicks) return
    scene.clicks.forEach((click, i) => {
      const key = sceneIdx * 1000 + i
      if (elapsed >= click.delay && elapsed < click.delay + TICK_MS * 2 && !prevClicksRef.current.has(key)) {
        prevClicksRef.current.add(key)
        const clickId = ++clickIdRef.current
        setActiveClicks(cs => [...cs, { id: clickId, x: click.x, y: click.y }])
        setTimeout(() => setActiveClicks(cs => cs.filter(c => c.id !== clickId)), 600)
      }
    })
  }, [elapsed, sceneIdx, scene.clicks])

  const seek = useCallback((ratio: number) => {
    const r = seekToRatio(scenes, ratio)
    setSceneIdx(r.sceneIdx)
    setElapsed(r.elapsed)
    prevClicksRef.current = new Set()
  }, [])

  const jumpToChapter = useCallback((chapterName: string) => {
    const idx = scenes.findIndex(s => s.chapter === chapterName)
    if (idx === -1) return
    setSceneIdx(idx)
    setElapsed(0)
    prevClicksRef.current = new Set()
    setPlaying(true)
  }, [])

  const restart = useCallback(() => {
    setSceneIdx(0)
    setElapsed(0)
    prevClicksRef.current = new Set()
    setPlaying(true)
  }, [])

  // Keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space') { e.preventDefault(); setPlaying(p => !p) }
      if (e.code === 'ArrowRight') seek(Math.min(1, progress + 0.05))
      if (e.code === 'ArrowLeft')  seek(Math.max(0, progress - 0.05))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [seek, progress])

  const chapters = Array.from(new Set(scenes.map(s => s.chapter)))
  const cursorPos = scene.cursorPath ? getCursorPos(scene.cursorPath, elapsed) : null

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <span className="text-white font-bold text-xl">EduDesk</span>
          <span className="bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full">Demo</span>
        </div>
        <a
          href="/login"
          className="bg-white text-slate-900 text-sm font-medium px-4 py-2 rounded-lg hover:bg-slate-100 transition-colors"
        >
          Giriş Yap →
        </a>
      </header>

      {/* Chapter Nav */}
      <div className="flex gap-2 px-6 py-3 border-b border-slate-800 overflow-x-auto">
        {chapters.map(ch => {
          const active = scene.chapter === ch
          return (
            <button
              key={ch}
              onClick={() => jumpToChapter(ch)}
              className={`whitespace-nowrap text-sm px-3 py-1.5 rounded-full transition-colors ${
                active
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {ch}
            </button>
          )
        })}
      </div>

      {/* Player */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-6 gap-4">
        {/* 16:9 container */}
        <div
          className="relative w-full max-w-4xl bg-slate-900 rounded-xl overflow-hidden shadow-2xl"
          style={{ aspectRatio: '16/9' }}
        >
          {/* Screenshot */}
          {!imgError && (
            <img
              key={scene.screenshot}
              src={`/demo/${scene.screenshot}`}
              alt={scene.chapter}
              className="absolute inset-0 w-full h-full object-cover"
              onError={() => setImgError(true)}
            />
          )}
          {imgError && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-800 text-slate-400 text-2xl font-medium">
              {scene.chapter}
            </div>
          )}

          {/* Highlights */}
          {scene.highlights?.map((h, i) => {
            const show = elapsed >= (h.delay ?? 0)
            return (
              <div
                key={i}
                className="absolute border-2 border-yellow-400 rounded pointer-events-none transition-opacity duration-300"
                style={{
                  left: `${h.x}%`,
                  top: `${h.y}%`,
                  width: `${h.width}%`,
                  height: `${h.height}%`,
                  opacity: show ? 1 : 0,
                }}
              >
                {h.label && (
                  <span className="absolute -top-6 left-0 bg-yellow-400 text-yellow-900 text-xs font-medium px-1.5 py-0.5 rounded whitespace-nowrap">
                    {h.label}
                  </span>
                )}
              </div>
            )
          })}

          {/* Cursor */}
          {cursorPos && (
            <div
              className="absolute pointer-events-none z-10"
              style={{
                left: `${cursorPos.x}%`,
                top: `${cursorPos.y}%`,
                transform: 'translate(-4px, -4px)',
                transition: 'left 80ms linear, top 80ms linear',
              }}
            >
              <svg width="20" height="24" viewBox="0 0 20 24" fill="none">
                <path d="M2 2L18 12L10 13L6 22L2 2Z" fill="black" stroke="white" strokeWidth="1.5" strokeLinejoin="round"/>
              </svg>
            </div>
          )}

          {/* Click Ripples */}
          {activeClicks.map(click => (
            <div
              key={click.id}
              className="absolute pointer-events-none z-10 -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${click.x}%`, top: `${click.y}%` }}
            >
              <div className="w-8 h-8 rounded-full border-2 border-blue-400 animate-ping" />
            </div>
          ))}

          {/* Finished overlay */}
          {isFinished && (
            <div className="absolute inset-0 bg-slate-950/80 flex flex-col items-center justify-center gap-4">
              <p className="text-white text-xl font-medium">Demo tamamlandı</p>
              <button
                onClick={restart}
                className="bg-blue-600 text-white px-6 py-2.5 rounded-lg hover:bg-blue-500 transition-colors"
              >
                Yeniden Başlat
              </button>
              <a
                href="/login"
                className="text-slate-300 hover:text-white underline text-sm transition-colors"
              >
                EduDesk'e Başla →
              </a>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="w-full max-w-4xl space-y-2">
          {/* Progress bar */}
          <input
            type="range"
            min={0}
            max={1}
            step={0.001}
            value={progress}
            onChange={e => seek(Number(e.target.value))}
            className="w-full h-1.5 accent-blue-500 cursor-pointer"
          />

          {/* Bottom row */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => isFinished ? restart() : setPlaying(p => !p)}
              className="text-white bg-slate-700 hover:bg-slate-600 w-9 h-9 rounded-lg flex items-center justify-center transition-colors flex-shrink-0"
              aria-label={playing ? 'Duraklat' : 'Oynat'}
            >
              {playing && !isFinished ? (
                <svg width="14" height="14" fill="currentColor" viewBox="0 0 14 14">
                  <rect x="2" y="1" width="4" height="12" rx="1"/>
                  <rect x="8" y="1" width="4" height="12" rx="1"/>
                </svg>
              ) : (
                <svg width="14" height="14" fill="currentColor" viewBox="0 0 14 14">
                  <path d="M3 2L12 7L3 12V2Z"/>
                </svg>
              )}
            </button>

            <span className="text-slate-400 text-sm tabular-nums flex-shrink-0">
              {formatTime(doneMs + elapsed)} / {formatTime(totalMs)}
            </span>

            <p className="text-slate-300 text-sm truncate">
              {scene.caption}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Commit**

```bash
git add app/demo/DemoPlayer.tsx
git commit -m "feat(demo): add DemoPlayer client component with animation engine"
```

---

## Task 5: Page Component

**Files:**
- Create: `app/demo/page.tsx`

- [ ] **`app/demo/page.tsx` oluştur**

```tsx
import type { Metadata } from 'next'
import DemoPlayer from './DemoPlayer'

export const metadata: Metadata = {
  title: 'EduDesk Demo — İnteraktif Tur',
  description: 'EduDesk\'in özelliklerini interaktif demomuzla keşfedin: ödev takibi, yoklama, müdür paneli ve veli portalı.',
}

export default function DemoPage() {
  return <DemoPlayer />
}
```

- [ ] **`npx tsc --noEmit` çalıştır — 0 hata beklenir**

```bash
npx tsc --noEmit
```

- [ ] **Tüm testleri çalıştır**

```bash
npx vitest run
```

Beklenen: önceki tüm testler + 11 yeni demo testi yeşil

- [ ] **Commit**

```bash
git add app/demo/page.tsx
git commit -m "feat(demo): add /demo page — interactive product tour complete"
```

---

## Doğrulama Kontrol Listesi

1. `npx vitest run` → tüm testler yeşil (demo testleri dahil)
2. `npx tsc --noEmit` → 0 hata
3. `npm run dev` → `localhost:3000/demo` auth olmadan açılır
4. Oturum açık bir kullanıcı ile `/demo` → **yönlendirme yapılmaz**, sayfa açılır
5. Play/pause butonu çalışır
6. Chapter nav pill'lerine tıklayınca ilgili sahneye atlar
7. Progress bar sürüklenince doğru sahneye atlar
8. Space / ArrowLeft / ArrowRight klavye kısayolları çalışır
9. Son sahne bitince "Demo tamamlandı" overlay gösterilir
10. Screenshot yoksa placeholder görünür (imgError state)
