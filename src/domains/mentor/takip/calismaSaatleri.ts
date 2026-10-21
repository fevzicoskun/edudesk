// src/domains/mentor/takip/calismaSaatleri.ts
// Öğrenciye özel çalışma saatleri (haftaya değil öğrenciye ait): net süre, düzen metni, gün sayacı, kâğıt saatleri.
// Spec: docs/superpowers/specs/2026-10-21-mentor-takip-saatler-odevler-kagit-design.md
import { GUNLER, type Gorev } from './takipMath'
import { VARSAYILAN_DUZEN } from './sablonlar'

/** Saatler 'HH:MM'. Mola isteğe bağlı, ikisi birlikte. */
export type GunSaati = { bas: string; bit: string; molaBas?: string; molaBit?: string }
/** gunler: 7 eleman (0=Pzt…6=Paz); null = o gün çalışma yok. */
export type CalismaSaatleri = { gunler: (GunSaati | null)[]; not: string }

export const BOS_SAATLER: CalismaSaatleri = { gunler: Array(7).fill(null), not: '' }

const dk = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5))
const hhmm = (n: number) => `${String(Math.floor(n / 60)).padStart(2, '0')}.${String(n % 60).padStart(2, '0')}`

export const saatlerVarMi = (s: CalismaSaatleri | null) => !!s?.gunler.some(Boolean)

export function netSure(g: GunSaati | null): number {
  if (!g) return 0
  const mola = g.molaBas && g.molaBit ? dk(g.molaBit) - dk(g.molaBas) : 0
  return Math.max(0, dk(g.bit) - dk(g.bas) - mola)
}

/** "2 sa 15 dk", "45 dk", "2 sa" */
export function sureKisa(n: number): string {
  const s = Math.floor(n / 60), d = n % 60
  return s === 0 ? `${d} dk` : d === 0 ? `${s} sa` : `${s} sa ${d} dk`
}

export const saatYaz = (s: string) => s.replace(':', '.')

const gunAraligi = (g: GunSaati) =>
  `${saatYaz(g.bas)}–${saatYaz(g.bit)}${g.molaBas && g.molaBit ? ` (mola ${saatYaz(g.molaBas)}–${saatYaz(g.molaBit)})` : ''}`

/** "Pzt–Cum 18.00–20.30 (mola 19.30–20.00) · Cmt 10.00–13.00 · <not>" — ardışık aynı günler birleşir. */
export function duzenMetni(s: CalismaSaatleri): string {
  const parcalar: string[] = []
  for (let i = 0; i < 7; i++) {
    const g = s.gunler[i]
    if (!g) continue
    let j = i
    while (j + 1 < 7 && s.gunler[j + 1] && gunAraligi(s.gunler[j + 1]!) === gunAraligi(g)) j++
    parcalar.push(`${j > i ? `${GUNLER[i]}–${GUNLER[j]}` : GUNLER[i]} ${gunAraligi(g)}`)
    i = j
  }
  if (s.not.trim()) parcalar.push(s.not.trim())
  return parcalar.join(' · ')
}

/** Kâğıttaki "Günlük düzen": mentör yazdıysa o, boşsa (ya da eski varsayılan metinse) saatlerden. */
export const otomatikDuzenMi = (duzen: string) => !duzen.trim() || duzen === VARSAYILAN_DUZEN
export const kagitDuzeni = (duzen: string, s: CalismaSaatleri | null) => (otomatikDuzenMi(duzen) ? duzenMetni(s ?? BOS_SAATLER) : duzen)

/** Günün planlanan süresi: yalnız dk birimli görevler (soru/serbest 0). */
export const planlananDk = (gorevler: Gorev[], gun: number) =>
  gorevler.filter(g => g.gun === gun && g.birim === 'dk').reduce((t, g) => t + (g.miktar ?? 0), 0)

/** Kâğıt sırası: ödev görevleri (teslime göre) → diğerleri (girdi sırası) → soru/serbest saatsiz en sonda.
 *  Saat günün başlangıcından sürelerle ilerler. Molaya denk gelen görev molanın bitişinden başlar; molayı ortasından
 *  kesen görev yerinde başlar, mola içinde verilir (sonraki görev mola kadar kayar) — günün başı boş kalmasın. */
export function gorevSaatleri(g: GunSaati | null, gorevler: Gorev[]): { gorev: Gorev; saat: string | null }[] {
  const sureli = gorevler.filter(x => x.birim === 'dk')
  const sirali = [
    ...sureli.filter(x => x.odevId).sort((a, b) => (a.teslim ?? '').localeCompare(b.teslim ?? '')),
    ...sureli.filter(x => !x.odevId),
    ...gorevler.filter(x => x.birim !== 'dk'),
  ]
  if (!g) return sirali.map(gorev => ({ gorev, saat: null }))
  const mb = g.molaBas && g.molaBit ? dk(g.molaBas) : null, me = g.molaBit ? dk(g.molaBit) : null
  let t = dk(g.bas)
  return sirali.map(gorev => {
    if (gorev.birim !== 'dk') return { gorev, saat: null }
    const sure = gorev.miktar ?? 0
    if (mb !== null && me !== null && t >= mb && t < me) t = me
    const saat = hhmm(t)
    t += sure + (mb !== null && me !== null && t < mb && t + sure > mb ? me - mb : 0)
    return { gorev, saat }
  })
}
