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
  ogrenciler: [{ student_id: OGR, full_name: 'Ali', class_id: SINIF, class_name: '11-A', telefon: null, mesaj: '',
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
