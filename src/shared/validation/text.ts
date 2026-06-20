// Klavye-mash / çöp metin tespiti. Production'a anlamsız başlık (kkkkk, ooooo) girmesini önler.
// Kural: aynı karakterin 3+ ardışık tekrarı = mash. Türkçe'de meşru hiçbir kelime bunu yapmaz
// (çift harf — dikkat, hassas — meşru; üç+ değil), bu yüzden false-positive yok.
const MASH = /(.)\1\1/

// Girdi: serbest metin. Çıktı: anlamlı görünüyorsa true, çöp/boşsa false.
export function isMeaningfulText(text: string): boolean {
  const t = text.trim()
  if (t.length === 0) return false
  if (MASH.test(t.toLowerCase())) return false
  return true
}
