# Spec: EduDesk İnteraktif Demo Player

**Tarih:** 2026-06-14  
**Durum:** Onaylandı

---

## Amaç

`/demo` sayfası — EduDesk'i hiç görmemiş birinin uygulamayı tanıyabileceği, kod ile üretilmiş, video benzeri interaktif tur. Gerçek ekran görüntüleri üzerinde animasyonlu cursor, click ripple ve highlight kutuları çalışır; kullanıcı play/pause yapabilir, chapter'lara atlayabilir.

---

## Kapsam

- Auth gerektirmez (`/demo` → `PUBLIC_PATHS`)
- 8 sahne, 5 chapter
- Ekran görüntüleri `/public/demo/` klasöründe — eksik olduğunda renkli placeholder gösterir
- Yeni bağımlılık yok (saf CSS + React hooks)

---

## Dosyalar

| Dosya | Açıklama |
|-------|----------|
| `proxy.ts` | `PUBLIC_PATHS`'e `/demo` eklenir |
| `app/demo/page.tsx` | Server component (metadata + `<DemoPlayer />`) |
| `app/demo/DemoPlayer.tsx` | `'use client'` — tüm player mantığı |
| `app/demo/scenes.ts` | Sahne verisi (tip tanımları + `scenes` dizisi) |
| `public/demo/README.md` | Screenshot adları ve boyut rehberi |
| `tests/vitest/unit/demo/demoEngine.test.ts` | Pure fn testleri |

---

## Tip Tanımları — `scenes.ts`

```typescript
export type CursorStep = {
  x: number      // container genişliğinin yüzdesi (0-100)
  y: number      // container yüksekliğinin yüzdesi (0-100)
  delay: number  // sahne başından ms
}

export type ClickEffect = {
  x: number   // % 
  y: number   // %
  delay: number
}

export type HighlightBox = {
  x: number       // % left
  y: number       // % top
  width: number   // %
  height: number  // %
  label?: string
  delay?: number  // ms, default 0
}

export type Scene = {
  id: string
  chapter: string           // chapter nav'da gösterilir
  screenshot: string        // 'screenshot-01-dashboard.png'
  duration: number          // ms
  caption: string
  cursorPath?: CursorStep[]
  clicks?: ClickEffect[]
  highlights?: HighlightBox[]
}
```

---

## Sahneler (8 adet)

| # | id | chapter | screenshot | duration |
|---|----|---------|------------|---------|
| 1 | dashboard | Genel Bakış | screenshot-01-dashboard.png | 4000 |
| 2 | odev-olustur | Ödev Takibi | screenshot-02-odev-olustur.png | 5000 |
| 3 | odev-durum | Ödev Takibi | screenshot-03-odev-durum.png | 5000 |
| 4 | sinif-matrisi | Sınıf Matrisi | screenshot-04-matris.png | 4500 |
| 5 | yoklama | Yoklama | screenshot-05-yoklama.png | 5000 |
| 6 | cizelge | Yoklama | screenshot-06-cizelge.png | 4000 |
| 7 | devamsizlik-raporu | Müdür Paneli | screenshot-07-devamsizlik-raporu.png | 4500 |
| 8 | veli-portal | Veli Portalı | screenshot-08-veli.png | 4000 |

---

## Player Görünümü

```
┌────────────────────────────────────────────────────────┐
│  EduDesk  •  İnteraktif Demo                [Giriş →] │
├────────────────────────────────────────────────────────┤
│ [Genel Bakış] [Ödev Takibi] [Sınıf Matrisi] …        │  ← chapter nav (pill)
├────────────────────────────────────────────────────────┤
│                                                        │
│   ┌──────────────── 16:9 player ──────────────────┐   │
│   │   [ekran görüntüsü]                           │   │
│   │        ↖ cursor SVG (animasyonlu)             │   │
│   │        ○ click ripple                         │   │
│   │   [ sarı highlight kutu + label ]             │   │
│   └───────────────────────────────────────────────┘   │
│                                                        │
│  ▶  ━━━━━━━━━●──────────────────  02:14 / 04:30      │
│  "Ödev oluştur butonuna tıklıyoruz..."                │
└────────────────────────────────────────────────────────┘
```

---

## Animation Engine

### State

```typescript
const [sceneIdx, setSceneIdx] = useState(0)
const [elapsed, setElapsed]   = useState(0)   // ms, current scene içi
const [playing, setPlaying]   = useState(true)
```

### Tick (16ms interval)

```typescript
useEffect(() => {
  if (!playing) return
  const id = setInterval(() => {
    setElapsed(e => {
      const next = e + 16
      if (next >= scenes[sceneIdx].duration) {
        if (sceneIdx < scenes.length - 1) {
          setSceneIdx(i => i + 1)
          return 0
        }
        setPlaying(false)
        return scenes[sceneIdx].duration
      }
      return next
    })
  }, 16)
  return () => clearInterval(id)
}, [playing, sceneIdx])
```

### Cursor İnterpolasyonu (pure fn — test edilir)

```typescript
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
```

### Toplam İlerleme (pure fn — test edilir)

```typescript
export function getTotalProgress(
  scenes: Scene[],
  sceneIdx: number,
  elapsed: number
): number {
  const total = scenes.reduce((s, sc) => s + sc.duration, 0)
  const done  = scenes.slice(0, sceneIdx).reduce((s, sc) => s + sc.duration, 0)
  return (done + elapsed) / total
}
```

### Progress Bar Tıklama

```typescript
function seek(ratio: number) {
  const total   = scenes.reduce((s, sc) => s + sc.duration, 0)
  const target  = ratio * total
  let acc = 0
  for (let i = 0; i < scenes.length; i++) {
    if (acc + scenes[i].duration > target) {
      setSceneIdx(i)
      setElapsed(target - acc)
      return
    }
    acc += scenes[i].duration
  }
}
```

---

## Overlay Katmanları

### Cursor

- `position: absolute` div, `pointer-events: none`
- `left: ${pos.x}%`, `top: ${pos.y}%` → `transform: translate(-50%, -50%)`
- CSS `transition: left 80ms linear, top 80ms linear`
- İçerik: cursor SVG (siyah ok, beyaz outline)

### Click Ripple

- `clicks` içinden `delay <= elapsed && elapsed - delay < 600` olanlar render edilir
- `@keyframes ripple`: scale 0→2, opacity 1→0, 600ms

### Highlight Box

- `delay <= elapsed` koşulunu sağlayanlar gösterilir
- `opacity: 0 → 1`, `transition: opacity 300ms`
- `border: 2px solid #FBBF24` (sarı), `border-radius: 6px`
- Label: sarı pill, kutunun üst-sol köşesinde

### Screenshot Placeholder

```tsx
<img
  src={`/demo/${scene.screenshot}`}
  onError={e => { e.currentTarget.style.display = 'none'; setImgError(true) }}
/>
{imgError && (
  <div className="w-full h-full bg-slate-100 flex items-center justify-center text-slate-400 text-lg">
    {scene.chapter}
  </div>
)}
```

---

## Kontroller

| Öğe | Davranış |
|-----|----------|
| ▶ / ⏸ | `setPlaying(!playing)` |
| Progress bar | `<input type="range" min=0 max=1 step=0.001>` + `seek(value)` |
| Zaman | `MM:SS / MM:SS` formatında |
| Chapter nav pill | Tıklanınca o chapter'ın ilk sahnesine atla, `setPlaying(true)` |
| Son sahne bitince | Oynatma durur, progress 100%, yeniden başlatma butonu çıkar |

---

## Pure Fonksiyon Testleri — `demoEngine.test.ts`

| Fonksiyon | Senaryo |
|-----------|---------|
| `getCursorPos` | path boşsa null döner |
| `getCursorPos` | elapsed < ilk step.delay → null |
| `getCursorPos` | elapsed iki step arasında → doğru interpolasyon |
| `getCursorPos` | elapsed son stepten büyük → son step pozisyonu |
| `getTotalProgress` | sceneIdx=0, elapsed=0 → 0 |
| `getTotalProgress` | son sahne bitti → 1 |
| `getTotalProgress` | orta sahne orta elapsed → doğru oran |

---

## Dokunulmayacak Dosyalar

- `src/` altındaki hiçbir şey
- `database.types.ts`
- `app/(dashboard)/` altındaki hiçbir şey
