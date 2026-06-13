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
    chapter: 'Genel Bakis',
    screenshot: 'screenshot-01-dashboard.png',
    duration: 4000,
    caption: 'Mudur genel bakis ekrani - bugunku yoklama durumu, odev girisleri ve ogretmen aktivitesi tek ekranda.',
    highlights: [
      { x: 5, y: 15, width: 30, height: 20, label: 'Risk uyarilari', delay: 1000 },
      { x: 40, y: 15, width: 55, height: 20, label: 'Ogretmen aktivitesi', delay: 2500 },
    ],
  },
  {
    id: 'odev-olustur',
    chapter: 'Odev Takibi',
    screenshot: 'screenshot-02-odev-olustur.png',
    duration: 5000,
    caption: 'Tek seferde birden fazla sinifa odev atayin - baslik, aciklama ve teslim tarihi belirleyin.',
    cursorPath: [
      { x: 85, y: 8, delay: 500 },
      { x: 85, y: 8, delay: 1200 },
    ],
    clicks: [{ x: 85, y: 8, delay: 1200 }],
    highlights: [
      { x: 60, y: 40, width: 35, height: 40, label: 'Coklu sinif secimi', delay: 2500 },
    ],
  },
  {
    id: 'odev-durum',
    chapter: 'Odev Takibi',
    screenshot: 'screenshot-03-odev-durum.png',
    duration: 5000,
    caption: 'Her ogrencinin odev durumunu 5 secenekten biriyle isaretleyin: yapildi, eksik, yapilmadi, gec, mazeretli.',
    cursorPath: [
      { x: 20, y: 35, delay: 500 },
      { x: 20, y: 50, delay: 1500 },
      { x: 20, y: 65, delay: 2500 },
    ],
    highlights: [
      { x: 5, y: 30, width: 90, height: 50, label: 'Anlik durum guncelleme', delay: 3500 },
    ],
  },
  {
    id: 'sinif-matrisi',
    chapter: 'Sinif Matrisi',
    screenshot: 'screenshot-04-matris.png',
    duration: 4500,
    caption: 'Tum ogrenciler x tum odevler matris gorunumu - tamamlanma yuzdesi satir ve sutun bazli.',
    highlights: [
      { x: 0, y: 10, width: 100, height: 70, label: 'Ogrenci x Odev matrisi', delay: 800 },
      { x: 0, y: 80, width: 100, height: 15, label: 'Sutun tamamlanma %', delay: 2500 },
    ],
  },
  {
    id: 'yoklama',
    chapter: 'Yoklama',
    screenshot: 'screenshot-05-yoklama.png',
    duration: 5000,
    caption: 'Gunluk yoklama: mevcut, devamsiz, gec veya ozurlu. Toplu islemler ve kaydedilmemis degisiklik korumasi.',
    cursorPath: [
      { x: 50, y: 40, delay: 500 },
      { x: 50, y: 55, delay: 1500 },
    ],
    clicks: [{ x: 50, y: 40, delay: 1200 }],
    highlights: [
      { x: 5, y: 5, width: 90, height: 15, label: 'Toplu guncelleme butonlari', delay: 2500 },
    ],
  },
  {
    id: 'cizelge',
    chapter: 'Yoklama',
    screenshot: 'screenshot-06-cizelge.png',
    duration: 4000,
    caption: 'Aylik cizelge - gun adlari, bugun vurgusu ve MEB devamsizlik esigi renklendirmesi.',
    highlights: [
      { x: 5, y: 20, width: 90, height: 60, label: 'Aylik devamsizlik cizelgesi', delay: 800 },
    ],
  },
  {
    id: 'devamsizlik-raporu',
    chapter: 'Mudur Paneli',
    screenshot: 'screenshot-07-devamsizlik-raporu.png',
    duration: 4500,
    caption: 'Mudur raporu - MEB sinirina (15/20 gun) yaklasan ogrenciler risk sirasina gore listelenir. Excel export.',
    highlights: [
      { x: 5, y: 5, width: 90, height: 20, label: 'Tehlike / Uyari / Takip ozet kartlari', delay: 800 },
      { x: 5, y: 30, width: 90, height: 55, label: 'Risk sirali ogrenci listesi', delay: 2000 },
    ],
  },
  {
    id: 'veli-portal',
    chapter: 'Veli Portali',
    screenshot: 'screenshot-08-veli.png',
    duration: 4000,
    caption: 'Veli portali - veliler cocuklarinin odev gecmisini ve devamsizlik grafigini gorebilir.',
    highlights: [
      { x: 5, y: 10, width: 45, height: 35, label: 'Donem ozeti', delay: 800 },
      { x: 55, y: 10, width: 40, height: 35, label: 'Devamsizlik grafigi', delay: 2000 },
    ],
  },
]

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
