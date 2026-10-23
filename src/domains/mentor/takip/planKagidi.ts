import { gunSirasi, gunTarihi, kitapSayfaYaz, type Gorev } from './takipMath'
import { odevEtiketi } from './odevYerlesim'
import { tatilBul, type Tatil } from './tatiller'
import { gunAy } from '../lib/bultenMath'

/** Öğrenci plan kâğıdı kuralları (2026-10-24 yeniden tasarım, spec 2026-10-24-haftalik-plan-kagidi-yeniden).
 *  Veri değişmez: temizlik ve ayıklama yalnız çıktıda. */

export const GUN_TAM = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'] as const
export const GUN_KISA = ['Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct', 'Pz'] as const

const HARF = 'A-Za-zÇĞİÖŞÜçğıöşü'
// Öğretmen girişindeki ek cümle parçaları
const DOLGU = /(^|\s)(Çözelim|Yapalım|Tamamlansın|Arası)(?=\s|$|[.,])/giu

/** Ödev başlığını tek biçime getirir: "Başarıyorum Syf. 35 - 45 Arası Çözelim" → "Başarıyorum · s. 35–45". */
export function temizBaslik(s: string): string {
  let t = s.trim().replace(/\.+$/, '')
  t = t.replace(/(\d)\s*-\s*(\d)/g, '$1-$2') // "35 - 45"
  t = t.replace(new RegExp(`([${HARF}])\\s+-(\\d)`, 'g'), '$1-$2') // "Başarıyorum -1"
  t = t.replace(/(^|\s)Meb(?=\s|$|[.·])\.?/g, '$1MEB').replace(/MEB Kitabı/g, 'MEB kitabı')
  t = t.replace(/(^|\s)St Book(?=\s|$)/g, '$1Student Book').replace(/Kondüsyon/g, 'Kondisyon')
  t = t.replace(DOLGU, '').replace(/(^|\s)Kadar(?=\s|$)/g, '$1kadar')
  // Sayfa işareti → "s."; önünde kaynak varsa " · " ile ayrılır
  t = t.replace(/(^|\s|·)\s*(?:Sayfa|Syf|Sy|Sf|S)\s*\.?\s*:?\s*(?=\d)/gi, (_, on: string) => (on === '' ? 's. ' : ' · s. '))
  // İşaretsiz aralık kaynağın ardında: "4K 11-17" → "4K · s. 11-17"
  if (!/(^|\s)s\. /.test(t)) t = t.replace(/^(.*\S)\s+(\d+(?:-\d+)+)$/, '$1 · s. $2')
  // İki sayı aralık (0 → 1), üç ve fazlası tek tek sayfa listesi
  t = t.replace(/\d+(?:-\d+)+/g, m => { const p = m.split('-'); return p.length === 2 ? `${p[0] === '0' ? '1' : p[0]}–${p[1]}` : p.join(', ') })
  t = t.replace(/(\d)\((\p{L}),\s*(\p{L})\)/gu, '$1 ($2–$3)').replace(/\s*,\s*/g, ', ')
  return t.replace(/\s*·\s*/g, ' · ').replace(/\s+/g, ' ').trim().replace(/^· /, '')
}

const DERSLER = ['Matematik', 'Geometri', 'Fizik', 'Kimya', 'Biyoloji', 'Edebiyat', 'Türkçe', 'Tarih', 'Coğrafya', 'İngilizce', 'Almanca', 'Felsefe', 'Din']

/** "Ders — başlık" ödevi; şablon satırı "Matematik tarama testi"; yalnız ders adlarından oluşan genel satır → serbest tekrar. */
function dersMetin(g: Gorev): { ders: string; metin: string } {
  const i = g.ad.indexOf(' — ')
  if (g.odevId && i > 0) return { ders: g.ad.slice(0, i), metin: temizBaslik(g.ad.slice(i + 3)) }
  const kelimeler = g.ad.split(/[\s/+:]+/).filter(Boolean)
  if (kelimeler.length > 0 && kelimeler.every(k => DERSLER.includes(k))) return { ders: g.ad, metin: 'serbest tekrar' }
  if (DERSLER.includes(kelimeler[0])) {
    const kalan = g.ad.slice(kelimeler[0].length).replace(/^[:\s]+/, '')
    return { ders: kelimeler[0], metin: kalan === 'tekrarı' ? 'haftanın tekrarı' : kalan }
  }
  return { ders: g.ad, metin: '' }
}

const sureYaz = (g: Pick<Gorev, 'miktar' | 'birim'>) =>
  g.miktar === null || g.birim === 'serbest' ? '' : g.birim === 'dk' ? `${g.miktar} dk` : `${g.miktar} soru`

export type KagitSatiri = { id: string; ders: string; metin: string; sure: string; gecikmis: boolean; odev: boolean; test: boolean; uyari: string | null }

/** Tek aralıkta sayfa sayısı dakikayı aşarsa (kabaca dakikada 1 sayfa) uyarı. */
function sigmazMi(metin: string, g: Gorev): string | null {
  const m = /s\. (\d+)–(\d+)$/.exec(metin)
  if (!m || g.birim !== 'dk' || !g.miktar) return null
  const sayfa = Number(m[2]) - Number(m[1]) + 1
  return sayfa > g.miktar ? `${sayfa} sayfa · ${g.miktar} dk'ya sığmaz` : null
}

/** sayfalar: kitaba bağlı rutinde günün sayfa payı (gun → "s. 45–48"), hücrede yazar. */
export type Rutin = { ad: string; etiket: string; not: string; tur: 'kutu' | 'kesir' | 'sayfa'; gunler: number[]; sayfalar: Record<number, string> }

/** Rutin = ödev olmayan ve aynı adla haftanın ≥ 4 gününde geçen görev; plandaki ilk geçiş sırasıyla. */
export function rutinler(gorevler: Gorev[], hafta?: string): Rutin[] {
  const gunler = new Map<string, { g: Gorev; gunler: Set<number>; sayfalar: Record<number, string> }>()
  for (const g of gorevler) {
    if (g.odevId) continue
    const k = gunler.get(g.ad) ?? { g, gunler: new Set<number>(), sayfalar: {} }
    k.gunler.add(g.gun)
    // kitapSayfaYaz "Acil Mat s. 45–48" → hücrede yalnız pay
    const pay = g.kitapId ? kitapSayfaYaz(g, hafta).slice((g.kitapAdi ?? '').length).trim() : ''
    if (pay) k.sayfalar[g.gun] = pay
    gunler.set(g.ad, k)
  }
  return [...gunler.values()].filter(x => x.gunler.size >= 4).map(({ g, gunler: gs, sayfalar }) => {
    const parantez = /^(.*?)\s*\((.+)\)$/.exec(g.ad)
    const sure = sureYaz(g)
    return {
      ad: g.ad,
      etiket: (parantez?.[1] ?? g.ad).replace(/^Matematik /, 'Mat. '),
      not: [parantez?.[2] ?? sure, g.kitapAdi ?? '', g.soruSatiri ? 'çözdüm/doğru' : ''].filter(Boolean).join(' · '),
      tur: g.soruSatiri ? 'kesir' : /kitap okuma/i.test(g.ad) ? 'sayfa' : 'kutu',
      gunler: [...gs],
      sayfalar,
    }
  })
}

/** Rutin o gün yapılır mı: planda yoksa hayır; resmî tatilde okul tekrarı düşer (yarım günde değil). */
export const rutinGunuMu = (r: Rutin, gun: number, tatil: Tatil | null) =>
  r.gunler.includes(gun) && !(tatil?.tur === 'tatil' && r.ad === 'Okul tekrarı')

/** Güne özel satırlar: rutinler ve "Haftalık genel tekrar" çıkar, aynı ders+kaynakta gecikmiş olan kalır.
 *  Sıra taslaktaki gibi: gecikmiş → ödev → şablon görevi (her grup kendi içinde plan sırasıyla). */
export function gunSatirlari(gorevler: Gorev[], gun: number, rutinAdlari: Set<string>, bugun: string, hafta?: string): KagitSatiri[] {
  const satirlar = gorevler.filter(g => g.gun === gun && !rutinAdlari.has(g.ad) && g.ad !== 'Haftalık genel tekrar').map((g): KagitSatiri => {
    const dm = dersMetin(g)
    const kitap = g.kitapId ? kitapSayfaYaz(g, hafta) : ''
    const metin = [dm.metin, kitap].filter(Boolean).join(' · ')
    return { id: g.id, ders: dm.ders, metin, sure: sureYaz(g), gecikmis: !!g.teslim && odevEtiketi(g.teslim, bugun).tur === 'gecikmis', odev: !!g.odevId,
      test: g.soruSatiri, uyari: sigmazMi(metin, g) }
  })
  const anahtar = (s: KagitSatiri) => `${s.ders}|${s.metin.split(' · ')[0]}`
  const gecikmisAnahtar = new Set(satirlar.filter(s => s.gecikmis).map(anahtar))
  const kalan = satirlar.filter(s => s.gecikmis || !gecikmisAnahtar.has(anahtar(s)))
  const sira = (s: KagitSatiri) => (s.gecikmis ? 0 : s.odev ? 1 : 2)
  return [0, 1, 2].flatMap(k => kalan.filter(s => sira(s) === k))
}

/** Mentöre plan ekranında: sığmaz satırlar + resmî tatile 2'den fazla gecikmiş yığılması. */
export function planUyarilari(gorevler: Gorev[], hafta: string, bugun: string): string[] {
  const rutin = new Set(rutinler(gorevler, hafta).map(r => r.ad))
  return gunSirasi(hafta).flatMap(gun => {
    const tarih = gunTarihi(hafta, gun)
    const gunAdi = `${GUN_TAM[gun]} ${gunAy(tarih)}`
    const satirlar = gunSatirlari(gorevler, gun, rutin, bugun, hafta)
    const tatil = tatilBul(tarih)
    const gecikmis = satirlar.filter(s => s.gecikmis).length
    return [
      ...satirlar.flatMap(s => (s.uyari ? [`${gunAdi} · ${s.ders} — ${s.metin}: ${s.uyari}`] : [])),
      ...(tatil?.tur === 'tatil' && gecikmis > 2 ? [`${gunAdi} (${tatil.ad}): ${gecikmis} gecikmiş ödev yığılmış`] : []),
    ]
  })
}
