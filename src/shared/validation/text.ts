// Klavye-mash / çöp metin tespiti. Production'a anlamsız başlık (kkkkk, ooooo) girmesini önler.
// Kural: aynı HARFİN 3+ ardışık tekrarı = mash. Türkçe'de meşru hiçbir kelime bunu yapmaz
// (çift harf — dikkat, hassas — meşru; üç+ değil).
// 2026-09-28: kural önceden her karaktere bakıyordu — "sayfa 1000", "Tekrar...", "Ünite III"
// reddediliyordu. Rakam/noktalama hiç sayılmaz; Romen rakamı kelimeler (III, XXX) muaf.
const HARF_TEKRAR = /(\p{L})\1\1/u
// Küçültmeden ÖNCE bakılır: tr küçültmede "İİİ" ile "iii" aynı olur ama "İ" Romen harfi değildir
const ROMEN = /^[IVXLCDMivxlcdmı]+\.?$/

// Girdi: serbest metin. Çıktı: anlamlı görünüyorsa true, çöp/boşsa false.
export function isMeaningfulText(text: string): boolean {
  const t = text.trim()
  if (t.length === 0) return false
  return !t.split(/\s+/).some(kelime =>
    !ROMEN.test(kelime) && HARF_TEKRAR.test(kelime.toLocaleLowerCase('tr-TR')))
}
