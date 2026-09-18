import { errorFingerprint } from './alert-rate-limiter'

/** Tek bir hatanın tabloda kaplayacağı üst sınır — stack'i uzun hatalar şişirmesin */
export const MESAJ_SINIRI = 2000

/** logger redaction'ı ile aynı alan listesi; context serbest bir nesne olduğu için burada da maskelenir */
const GIZLI_ALANLAR = new Set([
  'password', 'token', 'jti', 'access_token', 'refresh_token',
])

export type HataKaynagi = 'client' | 'server' | 'cron'

export type HataKaydi = {
  name: string
  message: string
  fingerprint: string
  source: HataKaynagi
  context: Record<string, unknown>
}

/** Ham hata bilgisini DB'ye yazılabilir, güvenli ve sınırlı bir kayda çevirir. */
export function hataKaydiOlustur(girdi: {
  name: string
  message: string
  source: HataKaynagi
  context?: Record<string, unknown>
}): HataKaydi {
  const mesaj = girdi.message.trim() || '(mesaj yok)'

  const context: Record<string, unknown> = {}
  for (const [anahtar, deger] of Object.entries(girdi.context ?? {})) {
    if (deger === undefined || deger === null) continue
    context[anahtar] = GIZLI_ALANLAR.has(anahtar) ? '[GIZLI]' : deger
  }

  return {
    name:        girdi.name,
    message:     mesaj.slice(0, MESAJ_SINIRI),
    fingerprint: errorFingerprint(girdi.name, mesaj),
    source:      girdi.source,
    context,
  }
}

export type HamHataSatiri = {
  id: string
  fingerprint: string
  name: string
  message: string
  source: string
  created_at: string
}

export type HataGrubu = {
  fingerprint: string
  name: string
  message: string
  source: string
  adet: number
  ilkGorulme: string
  sonGorulme: string
}

/** Aynı parmak izli hataları tek satırda toplar; en son görülen grup başa gelir.
 *  Sıralama adede göre DEĞİL: 3 ay önce 500 kez olmuş bir hata, bugün 1 kez olanın
 *  üstünü örtmemeli — panelde aranan şey "şu an ne bozuk". */
export function gruplaHatalar(satirlar: HamHataSatiri[]): HataGrubu[] {
  const gruplar = new Map<string, HataGrubu>()

  for (const satir of satirlar) {
    const mevcut = gruplar.get(satir.fingerprint)
    if (!mevcut) {
      gruplar.set(satir.fingerprint, {
        fingerprint: satir.fingerprint,
        name:        satir.name,
        message:     satir.message,
        source:      satir.source,
        adet:        1,
        ilkGorulme:  satir.created_at,
        sonGorulme:  satir.created_at,
      })
      continue
    }
    mevcut.adet++
    if (satir.created_at > mevcut.sonGorulme) mevcut.sonGorulme = satir.created_at
    if (satir.created_at < mevcut.ilkGorulme) mevcut.ilkGorulme = satir.created_at
  }

  return [...gruplar.values()].sort((a, b) => b.sonGorulme.localeCompare(a.sonGorulme))
}
