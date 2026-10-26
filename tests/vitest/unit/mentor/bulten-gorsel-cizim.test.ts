// tests/vitest/unit/mentor/bulten-gorsel-cizim.test.ts
// Gerçek next/og çizimi (mock yok): uzun ödev başlığı kesilmez, alt satıra kayar ve görsel uzar.
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/src/infrastructure/observability/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }))
vi.mock('@/src/shared/authorization/server', () => ({ getAbility: vi.fn() }))
vi.mock('@/src/domains/mentor/services/BultenService', () => ({ BultenService: { getBulten: vi.fn() } }))

const { getAbility } = await import('@/src/shared/authorization/server')
const { BultenService } = await import('@/src/domains/mentor/services/BultenService')
const { GET } = await import('@/app/api/bulten/gorsel/route')

const SINIF = '11111111-1111-4111-8111-111111111111'
const OGR = '22222222-2222-4222-8222-222222222222'
// Canlıdaki gerçek başlık (12-B Tarih, 104 karakter)
const UZUN = 'Yanıt Yayınları : Sayfa 153,161,171,172,173 Başarıyorum Tyt-Ayt Soru Bankası : 15-18 Arası 155-160 Arası'
const bulten = (title: string) => ({
  hafta: '2026-10-26', okulAdi: 'Okul', mentorAdi: 'M', mentorUnvani: 'Matematik Öğretmeni M',
  siniflar: [{
    class_id: SINIF, class_name: '11-A',
    gunler: [{ gun: '2026-10-26', etiket: 'Pazartesi', odevler: [{ id: 'h', subject: 'Tarih', title, teacher_id: 't', ogretmen: 'Öğretmen' }] }],
    ozet: [{ id: 'h', subject: 'Tarih', title, due_date: '2026-10-21', toplam: 3, yapildi: 1, eksik: 1, yapilmadi: 1 }],
  }],
  ogrenciler: [{ student_id: OGR, full_name: 'Ali', class_id: SINIF, class_name: '11-A', telefon: null, mesaj: '', gecenHafta: { toplam: 3, yapildi: 2, eksik: 1, yapilmadi: 0 },
    eksikler: [{ id: 'h', subject: 'Tarih', title, due_date: '2026-10-21', durum: 'eksik' }] }],
})

/** PNG IHDR'den yükseklik (bayt 20–23, big-endian) */
async function yukseklik(q: string, title: string) {
  vi.mocked(BultenService.getBulten).mockResolvedValue(bulten(title) as never)
  const r = await GET(new Request(`http://x/api/bulten/gorsel?${q}`) as never)
  expect(r.status).toBe(200)
  return new DataView(await r.arrayBuffer()).getUint32(20)
}

beforeEach(() => vi.mocked(getAbility).mockResolvedValue({ cannot: () => false } as never))

/** RGBA 8 bit, interlace'siz PNG (resvg çıktısı) → piksel okuyucu. Yalnız node:zlib. */
async function pikseller(png: Buffer) {
  const { inflateSync } = await import('node:zlib')
  const g = png.readUInt32BE(16), y = png.readUInt32BE(20), idat: Buffer[] = []
  for (let i = 8; i < png.length;) {
    const n = png.readUInt32BE(i), tur = png.toString('ascii', i + 4, i + 8)
    if (tur === 'IDAT') idat.push(png.subarray(i + 8, i + 8 + n))
    i += 12 + n
  }
  const ham = inflateSync(Buffer.concat(idat)), s = g * 4, p = Buffer.alloc(s * y)
  for (let r = 0; r < y; r++) {
    const f = ham[r * (s + 1)]
    for (let x = 0; x < s; x++) {
      const v = ham[r * (s + 1) + 1 + x], a = x >= 4 ? p[r * s + x - 4] : 0, b = r ? p[(r - 1) * s + x] : 0, c = x >= 4 && r ? p[(r - 1) * s + x - 4] : 0
      const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c)
      p[r * s + x] = (v + [0, a, b, (a + b) >> 1, pa <= pb && pa <= pc ? a : pb <= pc ? b : c][f]) & 255
    }
  }
  return { g, y, rgb: (x: number, r: number) => [p[r * s + x * 4], p[r * s + x * 4 + 1], p[r * s + x * 4 + 2]] }
}

describe('öğrenci kartı: eksik satırında başlık durum etiketinin altına taşmaz', () => {
  // Canlı 9-A İdo Elçiçek kartı (2026-10-26): başlık tam genişlikte tek satır kırılıp "yapılmadı" etiketinin altına girdi.
  it.each([["Başarıyorum -1 Sayfa 41'e Kadar Tamamlansın."], ['4K Tde Soru Bankası Sf. 27-34 Arası Ve 43-44']])('%s', async title => {
    vi.mocked(BultenService.getBulten).mockResolvedValue(bulten(title) as never)
    const r = await GET(new Request(`http://x/api/bulten/gorsel?tur=ogrenci&hafta=2026-10-26&ogrenci=${OGR}`) as never)
    const { g, y, rgb } = await pikseller(Buffer.from(await r.arrayBuffer()))
    // "eksik" etiketi zemini #FFF1CC → kutusu. Etiket yazının üstüne çizilir (taşanı örter); bu yüzden
    // etiketin solundaki 16px boşluk (marginLeft) bakılır: orada başlık mürekkebi (#1D2B5F, lacivert) olmamalı.
    let [x0, x1, y0, y1] = [g, 0, y, 0]
    for (let r2 = 0; r2 < y; r2++) for (let x = 0; x < g; x++) {
      const [R, G, B] = rgb(x, r2)
      if (R === 0xFF && G === 0xF1 && B === 0xCC) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, r2); y1 = Math.max(y1, r2) }
    }
    expect(x1).toBeGreaterThan(x0)
    let lacivert = 0
    for (let r2 = y0; r2 <= y1; r2++) for (let x = x0 - 14; x < x0; x++) {
      const [R, G, B] = rgb(x, r2)
      if (R < 120 && B > R + 30 && B > G + 20) lacivert++
    }
    expect(lacivert).toBe(0)
    // sağ kenar boşluğu (padding 60px) da temiz: "bu hafta" satırı sağdan taşmaz
    let sagda = 0
    for (let r2 = 0; r2 < y; r2++) for (let x = g - 50; x < g; x++) {
      const [R, G, B] = rgb(x, r2)
      if (R < 120 && B > R + 30 && B > G + 20) sagda++
    }
    expect(sagda).toBe(0)
  }, 30_000)
})

describe('bülten görseli: uzun ödev başlığı', () => {
  it.each([
    `tur=odevler&hafta=2026-10-26&sinif=${SINIF}`,
    `tur=ozet&hafta=2026-10-26&sinif=${SINIF}`,
    `tur=ogrenci&hafta=2026-10-26&ogrenci=${OGR}`,
  ])('alt satıra kayar, görsel uzar (%s)', async q => {
    const kisa = await yukseklik(q, 'Sayfa 1-5')
    const uzun = await yukseklik(q, UZUN)
    // en az bir ek satır (≥ ~34px punto) daha uzun
    expect(uzun - kisa).toBeGreaterThanOrEqual(34)
  }, 30_000)
})
