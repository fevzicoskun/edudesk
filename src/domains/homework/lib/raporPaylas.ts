/**
 * Ödev kontrol raporunu resim olarak paylaşma (WhatsApp vb.).
 *
 * Resim, yazdırma raporunun (PrintRapor) KENDİSİNDEN üretilir — ayrı bir paylaşım
 * tasarımı yok, kağıttaki düzeltmeler resme de otomatik yansır.
 */

/** "odev-raporu-11-B-2026-09-27.png" — gün İstanbul'a göre kesilir */
export function raporDosyaAdi(sinif: string, an: Date): string {
  const gun = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Istanbul' }).format(an)
  const temiz = sinif.trim().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '')
  return ['odev-raporu', temiz, gun].filter(Boolean).join('-') + '.png'
}

type PaylasimNavigator = Pick<Partial<Navigator>, 'canShare' | 'share'>

/** Dosya paylaşımı yoksa (masaüstü tarayıcıların çoğu) resim indirilir */
export function paylasmaYolu(nav: PaylasimNavigator, dosya: File): 'paylas' | 'indir' {
  return nav.share && nav.canShare?.({ files: [dosya] }) ? 'paylas' : 'indir'
}

/** A4 genişliği @96dpi — resim kağıttaki satır kırılımlarıyla aynı çıksın */
const A4_PX = 794

/**
 * Sayfadaki [data-odev-rapor] öğesinin resmini alıp paylaşır ya da indirir.
 * Rapor ekranda `hidden` (yalnız print'te görünür) → ekran dışında görünür bir
 * kopyası çizilip o yakalanır. Kullanıcının paylaşım menüsünü kapatması hata değildir.
 */
export async function raporuPaylas(sinif: string): Promise<void> {
  const kaynak = document.querySelector<HTMLElement>('[data-odev-rapor]')
  if (!kaynak) throw new Error('Rapor bulunamadı')

  const kopya = kaynak.cloneNode(true) as HTMLElement
  kopya.classList.remove('hidden')
  // Telefonda boş not satırları/imza/"Yazdırma" alt bilgisi kalabalık yapıyordu (kullanıcı 2026-09-30)
  kopya.querySelectorAll('[data-kagit]').forEach(el => el.remove())
  const kap = document.createElement('div')
  kap.style.cssText = `position:fixed;left:-10000px;top:0;width:${A4_PX}px;padding:32px;background:#fff`
  kap.appendChild(kopya)
  document.body.appendChild(kap)

  let blob: Blob
  try {
    const { domToBlob } = await import('modern-screenshot')
    blob = await domToBlob(kap, { scale: 2, backgroundColor: '#ffffff', type: 'image/png' })
  } finally {
    kap.remove()
  }

  const dosya = new File([blob], raporDosyaAdi(sinif, new Date()), { type: 'image/png' })

  if (paylasmaYolu(navigator, dosya) === 'paylas') {
    try {
      await navigator.share({ files: [dosya] })
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return
      throw e
    }
    return
  }

  const url = URL.createObjectURL(dosya)
  const a = Object.assign(document.createElement('a'), { href: url, download: dosya.name })
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
