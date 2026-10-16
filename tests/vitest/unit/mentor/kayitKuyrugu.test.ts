import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { kayitKuyrugu, type KayitDurumu, type KayitSonucu } from '@/src/domains/mentor/takip/kayitKuyrugu'

let durumlar: KayitDurumu[]
const son = () => durumlar.at(-1)
const bekle = () => vi.advanceTimersByTimeAsync(0)

beforeEach(() => { vi.useFakeTimers(); durumlar = [] })
afterEach(() => { vi.useRealTimers() })

const kur = (kaydet: (v: string, sonBilinen: string | null) => Promise<KayitSonucu>) =>
  kayitKuyrugu(kaydet, 't0', d => durumlar.push(d), 800)

describe('kayitKuyrugu', () => {
  it('800 ms içindeki iki değişiklik tek istekte, son değerle yazılır', async () => {
    const kaydet = vi.fn().mockResolvedValue({ updatedAt: 't1' })
    const k = kur(kaydet)
    k.degisti('a'); await vi.advanceTimersByTimeAsync(400); k.degisti('b')
    await vi.advanceTimersByTimeAsync(800)
    expect(kaydet).toHaveBeenCalledTimes(1)
    expect(kaydet).toHaveBeenCalledWith('b', 't0')
    expect(son()?.tur).toBe('kaydedildi')
  })

  it('anlık değişiklik gecikmesiz yazılır', async () => {
    const kaydet = vi.fn().mockResolvedValue({ updatedAt: 't1' })
    kur(kaydet).degisti('a', true)
    await bekle()
    expect(kaydet).toHaveBeenCalledTimes(1)
  })

  it('bağlantı hatası: tek istek, kendiliğinden tekrar YOK (sonsuz döngü regresyonu)', async () => {
    const kaydet = vi.fn().mockRejectedValue(new Error('ağ'))
    kur(kaydet).degisti('a')
    await vi.advanceTimersByTimeAsync(60_000)
    expect(kaydet).toHaveBeenCalledTimes(1)
    expect(son()).toEqual({ tur: 'hata', mesaj: 'Bağlantı hatası' })
  })

  it('hatadan sonra bosalt (Tekrar dene) aynı veriyi yeniden yazar', async () => {
    const kaydet = vi.fn().mockRejectedValueOnce(new Error('ağ')).mockResolvedValue({ updatedAt: 't1' })
    const k = kur(kaydet)
    k.degisti('a'); await vi.advanceTimersByTimeAsync(800)
    expect(await k.bosalt()).toBe(true)
    expect(kaydet).toHaveBeenNthCalledWith(2, 'a', 't0')
    expect(son()?.tur).toBe('kaydedildi')
  })

  it('sunucu hata mesajı duruma geçer', async () => {
    const kaydet = vi.fn().mockResolvedValue({ error: 'Görev adı boş olamaz' })
    kur(kaydet).degisti('a', true); await bekle()
    expect(son()).toEqual({ tur: 'hata', mesaj: 'Görev adı boş olamaz' })
  })

  it('kayıt sürerken gelen değişiklik bitince güncel updated_at ile yazılır', async () => {
    let bitir!: (r: KayitSonucu) => void
    const kaydet = vi.fn()
      .mockImplementationOnce(() => new Promise<KayitSonucu>(r => { bitir = r }))
      .mockResolvedValue({ updatedAt: 't2' })
    const k = kur(kaydet)
    k.degisti('a', true); await bekle()
    k.degisti('b', true); await bekle()
    expect(kaydet).toHaveBeenCalledTimes(1)
    bitir({ updatedAt: 't1' }); await bekle()
    expect(kaydet).toHaveBeenNthCalledWith(2, 'b', 't1')
  })

  it('bosalt: bekleyen + süren kayıt bitince true döner (yazdırmadan önce)', async () => {
    let bitir!: (r: KayitSonucu) => void
    const kaydet = vi.fn()
      .mockImplementationOnce(() => new Promise<KayitSonucu>(r => { bitir = r }))
      .mockResolvedValue({ updatedAt: 't2' })
    const k = kur(kaydet)
    k.degisti('a', true); await bekle()
    k.degisti('b')
    let sonuc: boolean | undefined
    void k.bosalt().then(x => { sonuc = x })
    await bekle()
    expect(sonuc).toBeUndefined()
    bitir({ updatedAt: 't1' }); await bekle(); await bekle()
    expect(sonuc).toBe(true)
    expect(kaydet).toHaveBeenLastCalledWith('b', 't1')
    expect(k.bekleyenVar()).toBe(false)
  })

  it('bosalt: kayıt başarısızsa false döner', async () => {
    const kaydet = vi.fn().mockResolvedValue({ error: 'x' })
    const k = kur(kaydet)
    k.degisti('a')
    expect(await k.bosalt()).toBe(false)
  })

  it('çakışmadan sonra yeni değişiklikler istek atmaz', async () => {
    const kaydet = vi.fn().mockResolvedValue({ cakisma: true })
    const k = kur(kaydet)
    k.degisti('a', true); await bekle()
    k.degisti('b', true); await vi.advanceTimersByTimeAsync(5000)
    expect(kaydet).toHaveBeenCalledTimes(1)
    expect(son()?.tur).toBe('cakisma')
  })
})
