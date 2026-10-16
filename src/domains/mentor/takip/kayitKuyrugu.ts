// Otomatik kayıt kuyruğu (React'ten bağımsız, sahte zamanlayıcıyla test edilir).
// Kurallar: gecikmeli yazım; aynı anda tek istek, sıradaki hep SON değer; hata → kendiliğinden tekrar YOK
// (bağlantı kopunca sonsuz istek döngüsü olmasın), yeni değişiklik ya da bosalt() tekrar dener;
// çakışma → yazım durur (sayfa yenilenmeli).

export type KayitSonucu = { error?: string; cakisma?: boolean; updatedAt?: string }
export type KayitDurumu =
  | { tur: 'bos' } | { tur: 'kaydediliyor' } | { tur: 'kaydedildi'; saat: string }
  | { tur: 'hata'; mesaj: string } | { tur: 'cakisma' }

export function kayitKuyrugu<T>(
  kaydet: (v: T, sonBilinen: string | null) => Promise<KayitSonucu>,
  ilkUpdatedAt: string | null,
  durumYaz: (d: KayitDurumu) => void,
  gecikme = 800,
) {
  let sonBilinen = ilkUpdatedAt
  let bekleyen: { v: T } | null = null
  let calisiyor = false
  let cakisti = false
  let zaman: ReturnType<typeof setTimeout> | null = null
  let bekleyenSozler: ((basarili: boolean) => void)[] = []

  const sozleriCoz = () => {
    if (calisiyor || zaman) return
    const basarili = bekleyen === null && !cakisti
    bekleyenSozler.forEach(c => c(basarili))
    bekleyenSozler = []
  }

  async function yaz(): Promise<void> {
    if (calisiyor) return // süren kayıt bitince sıradakini kendisi yazar
    if (!bekleyen || cakisti) { sozleriCoz(); return }
    calisiyor = true
    const { v } = bekleyen
    bekleyen = null
    durumYaz({ tur: 'kaydediliyor' })
    let devam = false
    try {
      const r = await kaydet(v, sonBilinen)
      if (r.cakisma) {
        cakisti = true
        durumYaz({ tur: 'cakisma' })
      } else if (r.error || !r.updatedAt) {
        bekleyen ??= { v }
        durumYaz({ tur: 'hata', mesaj: r.error ?? 'Kaydedilemedi' })
      } else {
        sonBilinen = r.updatedAt
        durumYaz({ tur: 'kaydedildi', saat: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) })
        devam = bekleyen !== null // kayıt sürerken gelen değişiklik
      }
    } catch {
      bekleyen ??= { v }
      durumYaz({ tur: 'hata', mesaj: 'Bağlantı hatası' })
    } finally {
      calisiyor = false
    }
    // Yalnız başarıdan sonra ve zamanlayıcı yoksa devam; hatada döngü YOK
    if (devam && !zaman) return yaz()
    sozleriCoz()
  }

  return {
    /** Yeni değer; `anlik` → gecikmesiz (kutu/seçim). */
    degisti(v: T, anlik = false) {
      bekleyen = { v }
      if (zaman) clearTimeout(zaman)
      zaman = setTimeout(() => { zaman = null; void yaz() }, anlik ? 0 : gecikme)
    },
    /** Bekleyeni hemen yaz; bekleyen + süren kayıt bitince çözülür. true = her şey kaydedildi. */
    bosalt(): Promise<boolean> {
      if (zaman) { clearTimeout(zaman); zaman = null }
      const soz = new Promise<boolean>(c => bekleyenSozler.push(c))
      void yaz()
      return soz
    },
    bekleyenVar: () => bekleyen !== null || calisiyor,
  }
}
