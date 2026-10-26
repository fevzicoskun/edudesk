// src/domains/mentor/lib/fontOlcu.ts
// TTF'den metin genişliği (cmap format 4 + hmtx). Satori iç içe span'ı satır içi akıtmadığı için
// kişisel karttaki "ders adı + ödev" satırında ödev metnine ders adı kadar textIndent verilir; o genişlik buradan.
// ponytail: kerning (GPOS) yok — birkaç px sapar, çağıran pay bırakır.

export function metinGenisligi(font: Buffer, metin: string, punto: number): number {
  if (!metin) return 0
  const tablo = (ad: string) => {
    for (let i = 0, n = font.readUInt16BE(4); i < n; i++) {
      const k = 12 + i * 16
      if (font.toString('ascii', k, k + 4) === ad) return font.readUInt32BE(k + 8)
    }
    throw new Error(`Font tablosu yok: ${ad}`)
  }
  const head = tablo('head'), hhea = tablo('hhea'), hmtx = tablo('hmtx'), cmap = tablo('cmap')
  const em = font.readUInt16BE(head + 18), metrikSayisi = font.readUInt16BE(hhea + 34)
  // Windows Unicode BMP (3,1) alt tablosu, format 4
  let alt = -1
  for (let i = 0, n = font.readUInt16BE(cmap + 2); i < n; i++) {
    const k = cmap + 4 + i * 8
    if (font.readUInt16BE(k) === 3 && font.readUInt16BE(k + 2) === 1) alt = cmap + font.readUInt32BE(k + 4)
  }
  if (alt < 0 || font.readUInt16BE(alt) !== 4) throw new Error('cmap format 4 yok')
  const seg = font.readUInt16BE(alt + 6) / 2
  const son = alt + 14, bas = son + seg * 2 + 2, delta = bas + seg * 2, aralik = delta + seg * 2
  const glif = (c: number) => {
    for (let i = 0; i < seg; i++) {
      if (c > font.readUInt16BE(son + i * 2)) continue
      if (c < font.readUInt16BE(bas + i * 2)) return 0
      const ro = font.readUInt16BE(aralik + i * 2), d = font.readInt16BE(delta + i * 2)
      if (!ro) return (c + d) & 0xffff
      const g = font.readUInt16BE(aralik + i * 2 + ro + (c - font.readUInt16BE(bas + i * 2)) * 2)
      return g ? (g + d) & 0xffff : 0
    }
    return 0
  }
  let birim = 0
  for (const ch of metin) {
    const g = glif(ch.codePointAt(0)!)
    birim += font.readUInt16BE(hmtx + Math.min(g, metrikSayisi - 1) * 4)
  }
  return (birim * punto) / em
}
