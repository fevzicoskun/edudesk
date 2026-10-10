import type { odevTakibi } from './odev-takibi'

/** Okul karnesi PDF'inin ödev bölümleri — Ödev Takibi ekranıyla aynı hesap (odevTakibi), yalnız tabloya dökülür. */

export type OdevTakibiSonucu = ReturnType<typeof odevTakibi>
export type KarneBolumu = { baslik: string; head: string[]; body: string[][]; not?: string }

export const KARNE_RISKLI_EN_FAZLA = 15

const yuzde = (v: number | null) => (v === null ? '—' : `%${v}`)
const bosSatir = (metin: string, sutun: number) => [[metin, ...Array<string>(sutun - 1).fill('')]]

export function odevKarnesiBolumleri(r: OdevTakibiSonucu): KarneBolumu[] {
  const riskli = r.riskliOgrenciler.slice(0, KARNE_RISKLI_EN_FAZLA)
  const kalanRiskli = r.riskliOgrenciler.length - riskli.length

  return [
    {
      baslik: 'Derslere göre',
      head: ['Ders', 'Ödev', 'Kontrol edildi', 'Kontrol bekleyen', 'Tamamlanma', 'Veren öğretmen'],
      body: r.dersler.length
        ? r.dersler.map(d => [d.ad, String(d.odev), String(d.kontrolEdildi), String(d.kontrolEdilecek), yuzde(d.tamamlanma),
            d.girenler.map(g => `${g.ad} ${g.sayi}`).join(', ')])
        : bosSatir('Henüz verilmiş ödev yok', 6),
    },
    {
      baslik: 'Sınıflara göre tamamlanma',
      head: ['Sınıf', 'Ödev', 'Tamamlanma'],
      body: r.siniflar.length
        ? r.siniflar.map(c => [c.ad, String(c.odev), yuzde(c.tamamlanma)])
        : bosSatir('Henüz verilmiş ödev yok', 3),
      not: 'En düşük tamamlanma üstte.',
    },
    {
      baslik: 'Öğretmenlere göre',
      head: ['Öğretmen', 'Ödev', 'Kontrol oranı', 'En eski bekleyen'],
      body: r.ogretmenler.length
        ? r.ogretmenler.map(o => [o.ad, String(o.odev), yuzde(o.kontrolOrani), o.enEskiBekleyen === null ? '—' : `${o.enEskiBekleyen} gün`])
        : bosSatir('Henüz verilmiş ödev yok', 4),
      not: 'Kontrol oranı: teslim günü geçmiş ödevlerden kontrol edilmiş olanların payı.',
    },
    {
      baslik: 'Riskli öğrenciler',
      head: ['Öğrenci', 'Sınıf', 'Oran', 'Yapılmadı+eksik / kontrol', 'Dersler'],
      body: riskli.length
        ? riskli.map(o => [o.ad, o.sinif, `%${o.oran}`, `${o.toplam}/${o.isaretli}`, o.dersler.map(d => `${d.ad} ${d.sayi}`).join(', ')])
        : bosSatir('Riskli öğrenci yok', 5),
      not: kalanRiskli > 0
        ? `En yüksek oranlı ${riskli.length} öğrenci gösterildi; ${kalanRiskli} öğrenci daha var (tümü Ödev Takibi ekranında).`
        : undefined,
    },
    {
      baslik: 'Bekleyen kontroller',
      head: ['Ödev', 'Ders', 'Sınıf', 'Öğretmen', 'Bekleme'],
      body: r.kontrolEdilecek.length
        ? r.kontrolEdilecek.map(k => [k.title, k.subject, k.sinif, k.ogretmen, `${k.gun} gün`])
        : bosSatir('Kontrol bekleyen ödev yok', 5),
    },
  ]
}
