/** Stoys AGİS Excel'i (spec 2026-10-22): 1. satır " Stoys Rapor ", sonra başlık ve öğrenciler.
 *  Sınav adı/tarihi dosyada YOK; tür ders sütunlarından anlaşılır. Saf: hücreler string gelir. */

export type DenemeTuru = 'TM' | 'FKB' | 'TCD'
export type DersSonucu = { kod: string; ss: number; d: number; y: number; n: number }
export type StoysSatir = { ad: string; dersler: DersSonucu[]; toplamNet: number; puan: number | null }

export const DERS_ADLARI: Record<string, string> = {
  TÜR: 'Türkçe', MAT: 'Matematik', FİZ: 'Fizik', KİM: 'Kimya', BİY: 'Biyoloji', TAR: 'Tarih', COĞ: 'Coğrafya', DİN: 'Din',
}

const TURLER: [DenemeTuru, string[]][] = [['TM', ['TÜR', 'MAT']], ['FKB', ['FİZ', 'KİM', 'BİY']], ['TCD', ['TAR', 'COĞ', 'DİN']]]
export const TANINMAYAN_DOSYA = 'Bu dosya Stoys AGİS raporuna benzemiyor (TM, FKB ya da TCD bulunamadı).'

const sayi = (x: string | undefined): number | null => {
  const t = (x ?? '').trim().replace(',', '.')
  if (t === '') return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

export function parseStoys(rows: string[][]):
  { tur: DenemeTuru; sinif: string; seviye: number; satirlar: StoysSatir[] } | { error: string } {
  const bi = rows.slice(0, 10).findIndex(r => r.some(c => c?.trim() === 'Adı Soyadı'))
  if (bi < 0) return { error: TANINMAYAN_DOSYA }
  const b = rows[bi].map(c => (c ?? '').trim())
  const kol = (ad: string) => b.indexOf(ad)
  const kodlar = b.flatMap(c => { const m = /^(.+)-N$/.exec(c); return m && m[1] !== 'TOP' ? [m[1]] : [] })
  const tur = TURLER.find(([, k]) => k.length === kodlar.length && k.every(x => kodlar.includes(x)))?.[0]
  if (!tur || kol('SINIF') < 0) return { error: TANINMAYAN_DOSYA }

  const veri = rows.slice(bi + 1).filter(r => (r[kol('Adı Soyadı')] ?? '').trim() !== '')
  if (veri.length === 0) return { error: 'Dosyada öğrenci satırı yok.' }
  const sinif = (veri[0][kol('SINIF')] ?? '').trim()
  const seviye = Number(/^(\d+)/.exec(sinif)?.[1])
  if (!(seviye >= 9 && seviye <= 12)) return { error: `Dosyadaki sınıf (${sinif || 'boş'}) 9–12. sınıf değil.` }

  const satirlar = veri.map((r): StoysSatir => {
    const dersler = kodlar.flatMap((kod): DersSonucu[] => {
      const n = sayi(r[kol(`${kod}-N`)])
      if (n === null) return []
      return [{ kod, ss: sayi(r[kol(`${kod}-SS`)]) ?? 0, d: sayi(r[kol(`${kod}-D`)]) ?? 0, y: sayi(r[kol(`${kod}-Y`)]) ?? 0, n }]
    })
    return {
      ad: r[kol('Adı Soyadı')].trim(), dersler,
      toplamNet: sayi(r[kol('TOP-N')]) ?? dersler.reduce((t, d) => t + d.n, 0),
      puan: sayi(r[kol('AGIS-Puan')]),
    }
  })
  return { tur, sinif, seviye, satirlar }
}

/** Ad eşleştirme anahtarı: Türkçe büyük harf, tek boşluk ("Beren  Çıbıkçı" = "BEREN ÇIBIKÇI"). */
export const adAnahtari = (ad: string) => ad.trim().replace(/\s+/g, ' ').toLocaleUpperCase('tr-TR')

export type Eslesme = { eslesen: { studentId: string; satir: StoysSatir }[]; katilmayan: string[]; eslesmeyenSatirlar: StoysSatir[] }

/** Yalnız dosyanın sınıfındaki öğrenciler aday; aynı anahtar iki kez geçerse (dosyada ya da sınıfta) o ad eşleşmez. */
export function eslestir(satirlar: StoysSatir[], ogrenciler: { id: string; full_name: string; class_name: string | null }[], dosyaSinifi: string): Eslesme {
  const adaylar = ogrenciler.filter(o => o.class_name === dosyaSinifi)
  const say = <T,>(xs: T[], k: (x: T) => string) => xs.reduce((m, x) => m.set(k(x), (m.get(k(x)) ?? 0) + 1), new Map<string, number>())
  const dosyada = say(satirlar, s => adAnahtari(s.ad))
  const sinifta = say(adaylar, o => adAnahtari(o.full_name))
  const tekil = (k: string) => dosyada.get(k) === 1 && sinifta.get(k) === 1
  const satirOf = new Map(satirlar.map(s => [adAnahtari(s.ad), s]))
  const eslesen = adaylar.filter(o => tekil(adAnahtari(o.full_name))).map(o => ({ studentId: o.id, satir: satirOf.get(adAnahtari(o.full_name))! }))
  const alinan = new Set(eslesen.map(e => e.satir))
  return {
    eslesen,
    katilmayan: adaylar.filter(o => !tekil(adAnahtari(o.full_name))).map(o => o.id),
    eslesmeyenSatirlar: satirlar.filter(s => !alinan.has(s)),
  }
}
