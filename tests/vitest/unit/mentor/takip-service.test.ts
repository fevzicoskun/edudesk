import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { yeniHafta } from '@/src/domains/mentor/takip/takipMath'

vi.mock('@/src/shared/authorization/server', () => ({ requireAbility: vi.fn().mockResolvedValue({ userId: 'u1', schoolId: 's1' }) }))
vi.mock('@/src/infrastructure/observability/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }))
vi.mock('@/src/domains/mentor/repositories/TakipRepository', () => ({
  TakipRepository: {
    acikMi: vi.fn(), mentoruMu: vi.fn(), haftaEkle: vi.fn(), haftaGuncelle: vi.fn(),
    ogrenci: vi.fn(), hafta: vi.fn(), oncekiHafta: vi.fn(), kitaplar: vi.fn(), konuDurumlari: vi.fn(),
    gecmis: vi.fn(), konular: vi.fn(), konuTohumla: vi.fn(), haftaKapat: vi.fn(), kilidiAc: vi.fn(), mentiler: vi.fn(), durumlar: vi.fn(), kitapEkle: vi.fn(),
    calismaSaatleri: vi.fn(), calismaSaatleriYaz: vi.fn(), kagitBasildi: vi.fn(),
  },
}))
vi.mock('@/src/domains/homework/services/HomeworkService', () => ({
  HomeworkService: { getStudentHomeworkProfile: vi.fn().mockResolvedValue({ homeworks: [] }) },
}))
vi.mock('@/src/shared/auth', () => ({ getCurrentProfile: vi.fn().mockResolvedValue({ full_name: 'M', schools: { name: 'O' } }) }))
const { TakipRepository: R } = await import('@/src/domains/mentor/repositories/TakipRepository')
const { TakipService } = await import('@/src/domains/mentor/services/TakipService')
const { logger } = await import('@/src/infrastructure/observability/logger')
const { HomeworkService: HS } = await import('@/src/domains/homework/services/HomeworkService')

const SID = '11111111-1111-4111-8111-111111111111'
const girdi = (sonBilinen: string | null = null) => {
  const h = yeniHafta(null, 9)
  h.icerik.gorevler[1] = { ...h.icerik.gorevler[1], yapti: true, soru: 40, dogru: 30 }
  return { studentId: SID, hafta: '2026-10-19', seviye: h.seviye, soruHedefi: h.soruHedefi, icerik: h.icerik, gorusme: h.gorusme, sonBilinen }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(R.acikMi).mockResolvedValue(true)
  vi.mocked(R.mentoruMu).mockResolvedValue(true)
  vi.mocked(R.haftaEkle).mockResolvedValue({ updatedAt: 't1' })
  vi.mocked(R.haftaGuncelle).mockResolvedValue({ updatedAt: 't2' })
})

describe('TakipService.kaydet', () => {
  it('bayrak kapalı → reddedilir, yazılmaz', async () => {
    vi.mocked(R.acikMi).mockResolvedValue(false)
    expect((await TakipService.kaydet(girdi())).error).toBeTruthy()
    expect(R.haftaEkle).not.toHaveBeenCalled()
  })
  it('mentörü değil → reddedilir', async () => {
    vi.mocked(R.mentoruMu).mockResolvedValue(false)
    expect((await TakipService.kaydet(girdi())).error).toBeTruthy()
  })
  it('ilk kayıt: özet sunucuda hesaplanır', async () => {
    const r = await TakipService.kaydet(girdi())
    expect(r).toEqual({ updatedAt: 't1' })
    expect(vi.mocked(R.haftaEkle).mock.calls[0][0]).toMatchObject({ soru: 40, dogru: 30, gorev_yapilan: 1, islendi: true, school_id: 's1', updated_by: 'u1' })
  })
  it('ilk kayıtta satır zaten varsa (başka sekme) → çakışma', async () => {
    vi.mocked(R.haftaEkle).mockResolvedValue({ cakisma: true })
    expect(await TakipService.kaydet(girdi())).toEqual({ cakisma: true })
  })
  it('güncelleme updated_at uyuşmazsa → çakışma', async () => {
    vi.mocked(R.haftaGuncelle).mockResolvedValue({ cakisma: true })
    expect(await TakipService.kaydet(girdi('2026-10-16T10:00:00.000Z'))).toEqual({ cakisma: true })
    expect(vi.mocked(R.haftaGuncelle).mock.calls[0][1]).toBe('2026-10-16T10:00:00.000Z')
  })
  it('geçersiz girdi (doğru>soru) → hata, yazılmaz', async () => {
    const g = girdi(); g.icerik.gorevler[1].dogru = 99
    expect((await TakipService.kaydet(g)).error).toMatch(/Doğru/)
    expect(R.haftaEkle).not.toHaveBeenCalled()
  })
})

describe('TakipService.sayfaVerisi — matematik konu tohumu (2026-10-17 tarama)', () => {
  const MAT = { id: 'k1', ders: 'Matematik', ad: 'Üslü ifadeler', grup: 'Sayılar' }
  beforeEach(() => {
    vi.mocked(R.ogrenci).mockResolvedValue({ id: SID, full_name: 'Ali', class_id: 'c1', veli_telefon: null, classes: { name: '9-A', grade: 9 } } as never)
    vi.mocked(R.hafta).mockResolvedValue(null as never)
    vi.mocked(R.oncekiHafta).mockResolvedValue(null as never)
    vi.mocked(R.kitaplar).mockResolvedValue([])
    vi.mocked(R.konuDurumlari).mockResolvedValue([])
    vi.mocked(R.gecmis).mockResolvedValue([] as never)
  })

  it('liste zaten doluysa tohum YAZILMAZ (her açılışta yazma yok)', async () => {
    vi.mocked(R.konular).mockResolvedValue([MAT])
    const v = await TakipService.sayfaVerisi(SID, '2026-10-19')
    expect(R.konuTohumla).not.toHaveBeenCalled()
    expect(v?.konular).toEqual([MAT])
  })

  it('liste boşsa tohumlanır ve yeniden okunur', async () => {
    vi.mocked(R.konular).mockResolvedValueOnce([]).mockResolvedValueOnce([MAT])
    const v = await TakipService.sayfaVerisi(SID, '2026-10-19')
    expect(R.konuTohumla).toHaveBeenCalledTimes(1)
    expect(v?.konular).toEqual([MAT])
  })

  it('tohum yazımı başarısızsa sayfa yine açılır (konu önerisi yardımcı, kritik değil), hata loglanır', async () => {
    vi.mocked(R.konular).mockResolvedValue([])
    vi.mocked(R.konuTohumla).mockRejectedValue(new Error('RLS 403'))
    const v = await TakipService.sayfaVerisi(SID, '2026-10-19')
    expect(v).not.toBeNull()
    expect(v?.konular).toEqual([])
    expect(logger.warn).toHaveBeenCalled()
  })
})

const { HomeworkService } = await import('@/src/domains/homework/services/HomeworkService')

describe('TakipService — haftayı kapat (2026-10-17)', () => {
  const odev = (id: string, due: string, status: string | null) => ({ id, title: id, subject: 'Fizik', due_date: due, status, note: null, teacher_id: 't', bekliyor: false })
  const satir = (o: object = {}) => ({
    hafta_basi: '2026-10-19', seviye: 1, soru_hedefi: 200, icerik: yeniHafta(null, 9).icerik, gorusme: {}, updated_at: 't0',
    gorev_toplam: 0, gorev_yapilan: 0, soru: 0, dogru: 0, okuma_sayfa: 0, islendi: false, kapali_at: null, okul_odevleri: null, ...o,
  })
  beforeEach(() => {
    vi.mocked(R.ogrenci).mockResolvedValue({ id: SID, full_name: 'Ali', class_id: 'c1', veli_telefon: null, classes: { name: '9-A', grade: 9 } } as never)
    vi.mocked(R.oncekiHafta).mockResolvedValue(null as never)
    vi.mocked(R.kitaplar).mockResolvedValue([])
    vi.mocked(R.konuDurumlari).mockResolvedValue([])
    vi.mocked(R.konular).mockResolvedValue([{ id: 'k', ders: 'Matematik', ad: 'A', grup: null }] as never)
    vi.mocked(R.haftaKapat).mockResolvedValue(undefined as never)
    vi.mocked(HomeworkService.getStudentHomeworkProfile).mockResolvedValue({ homeworks: [odev('h1', '2026-10-20', 'yapildi')] } as never)
  })

  it('kayıt yoksa ekranda görülen taslak kaydedilir, sonra kapatılır; okul ödevleri o anki hâliyle sabitlenir', async () => {
    vi.mocked(R.hafta).mockResolvedValue(null as never)
    expect(await TakipService.kapat(SID, '2026-10-19')).toEqual({})
    expect(R.haftaEkle).toHaveBeenCalledTimes(1)
    expect(vi.mocked(R.haftaEkle).mock.calls[0][0]).toMatchObject({ student_id: SID, hafta_basi: '2026-10-19', school_id: 's1' })
    const [okul, ogr, hafta, anlik] = vi.mocked(R.haftaKapat).mock.calls[0]
    expect([okul, ogr, hafta]).toEqual(['s1', SID, '2026-10-19'])
    expect((anlik as { buHafta: { id: string; status: string }[] }).buHafta.map(o => [o.id, o.status])).toEqual([['h1', 'yapildi']])
  })
  it('kayıt varsa yalnız kapatılır', async () => {
    vi.mocked(R.hafta).mockResolvedValue(satir() as never)
    expect(await TakipService.kapat(SID, '2026-10-19')).toEqual({})
    expect(R.haftaEkle).not.toHaveBeenCalled()
    expect(R.haftaKapat).toHaveBeenCalledTimes(1)
  })
  it('mentörü değil → kapatamaz', async () => {
    vi.mocked(R.mentoruMu).mockResolvedValue(false)
    expect((await TakipService.kapat(SID, '2026-10-19')).error).toBeTruthy()
    expect(R.haftaKapat).not.toHaveBeenCalled()
  })
  it('kapalı haftada okul ödevleri canlı veriden değil kapatma anından okunur', async () => {
    const anlik = { tamamlanmamis: [], buHafta: [odev('h1', '2026-10-20', 'yapilmadi')], gelecek: [] }
    vi.mocked(R.hafta).mockResolvedValue(satir({ kapali_at: '2026-10-26T10:00:00Z', okul_odevleri: anlik }) as never)
    const v = await TakipService.sayfaVerisi(SID, '2026-10-19')
    expect(v!.kayit!.kapaliAt).toBe('2026-10-26T10:00:00Z')
    expect(v!.okulOdevleri.buHafta[0].status).toBe('yapilmadi') // canlıda 'yapildi'
  })
  it('kapalı haftaya kayıt DB tetikleyicisinden döner → anlaşılır hata', async () => {
    vi.mocked(R.haftaGuncelle).mockResolvedValue({ kapali: true })
    expect((await TakipService.kaydet(girdi('2026-10-16T10:00:00.000Z'))).error).toMatch(/kapalı/)
  })
  it('kilidi aç', async () => {
    vi.mocked(R.kilidiAc).mockResolvedValue(undefined as never)
    expect(await TakipService.kilidiAc(SID, '2026-10-19')).toEqual({})
    expect(R.kilidiAc).toHaveBeenCalledWith('s1', SID, '2026-10-19')
  })
})

describe('TakipService — kopyala / herkese uygula (2026-10-17)', () => {
  const B = '22222222-2222-4222-8222-222222222222', C = '33333333-3333-4333-8333-333333333333'
  const plan = () => {
    const h = yeniHafta(null, 9)
    h.icerik.gorevler[1] = { ...h.icerik.gorevler[1], kitapId: 'kA', kitapAdi: 'Acil Mat', sayfaBas: 45, sayfaSon: 60, yapti: true }
    h.icerik.sonuclar = [{ anahtar: 'k:kA', ad: 'Acil Mat', ders: 'Matematik', sayfa: '', cozulen: 40, dogru: 30, yanlis: 8, bos: 2 }]
    return h
  }
  const satir = (h = plan()) => ({ hafta_basi: '2026-10-12', seviye: h.seviye, soru_hedefi: h.soruHedefi, icerik: h.icerik, gorusme: { iyi: 'not' }, updated_at: 't0', kapali_at: null })

  it('geçen haftayı kopyala: önceki kayıttan sonuçsuz plan, sayfa devam eder; yazmaz', async () => {
    vi.mocked(R.oncekiHafta).mockResolvedValue(satir() as never)
    const r = await TakipService.oncekiPlan(SID, '2026-10-19')
    expect(r.kaynak).toBe('2026-10-12')
    expect(r.veri!.icerik.gorevler[1]).toMatchObject({ kitapId: 'kA', sayfaBas: 61, sayfaSon: 76, yapti: false })
    expect(r.veri!.icerik.sonuclar ?? []).toEqual([])
    expect(R.haftaEkle).not.toHaveBeenCalled()
  })
  it('önceki kayıt yoksa anlaşılır hata', async () => {
    vi.mocked(R.oncekiHafta).mockResolvedValue(null as never)
    expect((await TakipService.oncekiPlan(SID, '2026-10-19')).error).toMatch(/plan yok/)
  })

  it('herkese uygula: planı olan atlanır; kitap yoksa tanımlanır, varsa (ad+ders) eşlenir; sonuç/görüşme taşınmaz', async () => {
    vi.mocked(R.hafta).mockResolvedValue({ ...satir(), hafta_basi: '2026-10-19' } as never)
    vi.mocked(R.mentiler).mockResolvedValue([SID, B, C, 'D'])
    vi.mocked(R.durumlar).mockResolvedValue([{ student_id: 'D' }] as never) // D'nin bu hafta planı var
    vi.mocked(R.kitaplar).mockImplementation(async (_s, ogr) => (
      ogr === SID ? [{ id: 'kA', ad: 'Acil Mat', ders: 'Matematik' }]
        : ogr === B ? [{ id: 'kB', ad: 'Acil Mat', ders: 'Matematik' }] : []) as never)
    vi.mocked(R.kitapEkle).mockResolvedValue({ data: { id: 'kC', ad: 'Acil Mat', ders: 'Matematik' }, error: null } as never)

    expect(await TakipService.herkeseUygula(SID, '2026-10-19')).toEqual({ uygulanan: 2, atlanan: 1 })
    expect(R.kitapEkle).toHaveBeenCalledTimes(1)
    expect(R.kitapEkle).toHaveBeenCalledWith('s1', C, 'Acil Mat', 'Matematik')
    const yazilan = vi.mocked(R.haftaEkle).mock.calls.map(c => c[0])
    expect(yazilan.map(y => y.student_id)).toEqual([B, C])
    const gorev = (y: typeof yazilan[0]) => (y.icerik as { gorevler: { kitapId: string; sayfaBas: number; yapti: boolean }[] }).gorevler[1]
    expect(gorev(yazilan[0])).toMatchObject({ kitapId: 'kB', sayfaBas: 45, yapti: false })
    expect(gorev(yazilan[1])).toMatchObject({ kitapId: 'kC', sayfaBas: 45 })
    expect((yazilan[0].icerik as { sonuclar?: unknown[] }).sonuclar ?? []).toEqual([])
    expect(yazilan[0]).toMatchObject({ gorev_yapilan: 0, islendi: false, soru: 0 })
  })
  it('herkese uygula: bu haftanın planı kaydedilmemişse hata, kimseye yazmaz', async () => {
    vi.mocked(R.hafta).mockResolvedValue(null as never)
    expect((await TakipService.herkeseUygula(SID, '2026-10-19')).error).toBeTruthy()
    expect(R.haftaEkle).not.toHaveBeenCalled()
  })
})

describe('TakipService.kitapHerkese — tüm mentör öğrencilerime kitap (2026-10-17)', () => {
  it('olan (ad+ders, büyük/küçük harf ve boşluk duyarsız) atlanır, olmayana eklenir', async () => {
    vi.mocked(R.mentiler).mockResolvedValue(['a', 'b', 'c'])
    vi.mocked(R.kitaplar).mockImplementation(async (_s, ogr) => (ogr === 'b' ? [{ id: 'k', ad: ' acil mat ', ders: 'Matematik' }] : []) as never)
    vi.mocked(R.kitapEkle).mockResolvedValue({ data: { id: 'n', ad: 'Acil Mat', ders: 'Matematik' }, error: null } as never)
    expect(await TakipService.kitapHerkese('Acil Mat', 'Matematik')).toEqual({ eklenen: 2, atlanan: 1 })
    expect(vi.mocked(R.kitapEkle).mock.calls.map(c => c[1])).toEqual(['a', 'c'])
  })
  it('bayrak kapalı → yazmaz', async () => {
    vi.mocked(R.acikMi).mockResolvedValue(false)
    expect((await TakipService.kitapHerkese('A', '')).error).toBeTruthy()
    expect(R.kitapEkle).not.toHaveBeenCalled()
  })
})

describe('TakipService — çalışma saatleri ve otomatik ödevler (2026-10-21)', () => {
  const OID = '44444444-4444-4444-8444-444444444444', B = '22222222-2222-4222-8222-222222222222'
  const hw = (due: string, status: string | null = null) => ({ id: OID, title: 'Orbital', subject: 'Kimya', due_date: due, status, note: null, teacher_id: 't', bekliyor: true, created_at: '2026-10-20T08:00:00Z' })
  const satir = (o: object = {}) => ({
    hafta_basi: '2026-10-19', seviye: 1, soru_hedefi: 200, icerik: { ...yeniHafta(null, 9).icerik, surum: 2 }, gorusme: {}, updated_at: 't0',
    gorev_toplam: 0, gorev_yapilan: 0, soru: 0, dogru: 0, okuma_sayfa: 0, islendi: false, kapali_at: null, okul_odevleri: null, kagit_basildi_at: null, ...o,
  })
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-21T09:00:00Z')) // Çarşamba
    vi.mocked(R.ogrenci).mockResolvedValue({ id: SID, full_name: 'Ali', class_id: 'c1', veli_telefon: null, classes: { name: '9-A', grade: 9 } } as never)
    vi.mocked(R.oncekiHafta).mockResolvedValue(null as never)
    vi.mocked(R.kitaplar).mockResolvedValue([])
    vi.mocked(R.konuDurumlari).mockResolvedValue([])
    vi.mocked(R.konular).mockResolvedValue([{ id: 'k', ders: 'Matematik', ad: 'A', grup: null }] as never)
    vi.mocked(R.calismaSaatleri).mockResolvedValue(null as never)
    vi.mocked(HS.getStudentHomeworkProfile).mockResolvedValue({ homeworks: [hw('2026-10-22')] } as never)
  })
  afterEach(() => vi.useRealTimers())
  const odevGorevleri = (v: Awaited<ReturnType<typeof TakipService.sayfaVerisi>>) => v!.taslak.icerik.gorevler.filter(g => g.odevId)

  it('bu hafta: yapılmamış ödev plana birleşir; saatler, damga ve verilme zamanı sayfa verisinde', async () => {
    vi.mocked(R.hafta).mockResolvedValue(satir({ kagit_basildi_at: '2026-10-19T10:00:00Z' }) as never)
    vi.mocked(R.calismaSaatleri).mockResolvedValue({ gunler: Array(7).fill(null), not: 'kurs' } as never)
    const v = await TakipService.sayfaVerisi(SID, '2026-10-19')
    expect(odevGorevleri(v).map(g => [g.odevId, g.gun])).toEqual([[OID, 2]])
    expect(v!.saatler).toEqual({ gunler: Array(7).fill(null), not: 'kurs' })
    expect(v!.kagitBasildiAt).toBe('2026-10-19T10:00:00Z')
    expect(v!.odevKayitlari.find(h => h.id === OID)?.created_at).toBe('2026-10-20T08:00:00Z')
    expect(v!.bugun).toBe('2026-10-21')
  })
  it('kapalı haftada birleşme yok', async () => {
    vi.mocked(R.hafta).mockResolvedValue(satir({ kapali_at: '2026-10-20T10:00:00Z' }) as never)
    expect(odevGorevleri(await TakipService.sayfaVerisi(SID, '2026-10-19'))).toEqual([])
  })
  it('geçmiş haftada birleşme yok', async () => {
    vi.mocked(R.hafta).mockResolvedValue(satir({ hafta_basi: '2026-10-12' }) as never)
    expect(odevGorevleri(await TakipService.sayfaVerisi(SID, '2026-10-12'))).toEqual([])
  })
  it('herkese uygula: otomatik ödev görevleri ve düzen metni kopyalanmaz', async () => {
    const ic = { ...satir().icerik, duzen: 'Benim düzenim' }
    ic.gorevler = [...ic.gorevler, { ...ic.gorevler[0], id: `o-${OID}`, grup: undefined, odevId: OID, teslim: '2026-10-22' }]
    vi.mocked(R.hafta).mockResolvedValue(satir({ icerik: ic }) as never)
    vi.mocked(R.mentiler).mockResolvedValue([SID, B])
    vi.mocked(R.durumlar).mockResolvedValue([] as never)
    await TakipService.herkeseUygula(SID, '2026-10-19')
    const yaz = vi.mocked(R.haftaEkle).mock.calls[0][0].icerik as { duzen: string; gorevler: { odevId?: string }[] }
    expect(yaz.duzen).toBe(''); expect(yaz.gorevler.some(g => g.odevId)).toBe(false)
  })
  it('saat kaydı: geçersiz reddedilir, geçerli yazılır', async () => {
    const gun = { bas: '18:00', bit: '20:30', molaBas: '19:30', molaBit: '20:00' }
    expect((await TakipService.saatleriKaydet(SID, { gunler: [{ bas: '20:00', bit: '18:00' }, null, null, null, null, null, null], not: '' })).error).toMatch(/Bitiş/)
    expect(R.calismaSaatleriYaz).not.toHaveBeenCalled()
    expect(await TakipService.saatleriKaydet(SID, { gunler: [gun, null, null, null, null, null, null], not: ' kurs ' })).toEqual({})
    expect(R.calismaSaatleriYaz).toHaveBeenCalledWith('s1', SID, 'u1', [gun, null, null, null, null, null, null], 'kurs')
  })
  it('saat kaydı: mentörü değil → yazmaz', async () => {
    vi.mocked(R.mentoruMu).mockResolvedValue(false)
    expect((await TakipService.saatleriKaydet(SID, { gunler: Array(7).fill(null), not: '' })).error).toBeTruthy()
    expect(R.calismaSaatleriYaz).not.toHaveBeenCalled()
  })
  it('kâğıt damgası yalnız yetkiliyse', async () => {
    await TakipService.kagitBasildi(SID, '2026-10-19')
    expect(R.kagitBasildi).toHaveBeenCalledWith('s1', SID, '2026-10-19')
    vi.mocked(R.mentoruMu).mockResolvedValue(false); vi.mocked(R.kagitBasildi).mockClear()
    await TakipService.kagitBasildi(SID, '2026-10-19')
    expect(R.kagitBasildi).not.toHaveBeenCalled()
  })
})
