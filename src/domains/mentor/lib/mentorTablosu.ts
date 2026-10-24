import { dersOzeti, dersAnahtari, type DersOzeti, type HomeworkRecord } from '@/src/domains/homework/lib/stats'
import { RISK_ESIGI } from '@/src/domains/homework/lib/odev-takibi'

export type MentorOgrenci = { id: string; full_name: string; class_name: string | null; homeworks: HomeworkRecord[] }
export type MentorHucre = { metin: string; ekler: string[]; renk: HucreRengi; aciklama: string }
export type MentorSatir = { id: string; full_name: string; class_name: string | null; hucreler: MentorHucre[]; dersler: DersOzeti[] }
export type DikkatSatiri = { id: string; full_name: string; toplam: number; dersler: string }
export type MentorTablo = { dersler: string[]; satirlar: MentorSatir[]; dikkat: DikkatSatiri[] }

/** Hücre rengi eşikleri (yapılan / değerlendirilen) — değiştirmek için yalnız burası. Tek kural, az veride de geçerli. */
export const KIRMIZI_ALTI = 50 // %50 altı kırmızı
export const TURUNCU_ALTI = 80 // %50–%80 arası turuncu; %80 ve üstü normal

export type HucreRengi = 'kirmizi' | 'turuncu' | null

/** "6/7" + ["1 eksik"]. Pay/payda dersOzeti ile aynı: mazeretli (sınıfta yok) ve işaretlenmemiş ödev paydada yok —
 *  paydalar bu yüzden öğrenciden öğrenciye değişir. "Girilmedi" ve mazeretli hücrede değil, yalnız açıklamada (title)
 *  — kullanıcı kararı 2026-10-24: hücre kalabalıklaşıyordu. */
export function hucreMetni(d: DersOzeti | undefined, mazeretli = 0): MentorHucre {
  if (!d) return { metin: '—', ekler: [], renk: null, aciklama: '' }
  const girilmedi = Math.max(0, d.toplam - d.degerlendirilen - mazeretli)
  const ekler = d.eksik ? [`${d.eksik} eksik`] : []
  const aciklama = [
    `${d.toplam} ödev`,
    d.degerlendirilen && `${d.degerlendirilen} ödevden ${d.yapildi} yapıldı`,
    d.eksik && `${d.eksik} eksik yapıldı`,
    d.gec && `${d.gec} geç`,
    girilmedi && `${girilmedi} henüz girilmedi`,
    mazeretli && `${mazeretli} mazeretli (sınıfta yok)`,
  ].filter(Boolean).join(' · ')
  if (d.degerlendirilen === 0) return { metin: '—', ekler, renk: null, aciklama }
  const oran = (d.yapildi / d.degerlendirilen) * 100
  return {
    metin: `${d.yapildi}/${d.degerlendirilen}`,
    ekler,
    renk: oran < KIRMIZI_ALTI ? 'kirmizi' : oran < TURUNCU_ALTI ? 'turuncu' : null,
    aciklama,
  }
}

/** Mentörün grubu: öğrenci × ders. Sütunlar grubun dersleri (dersAnahtari ile tekil), alfabetik. */
export function mentorTablosu(ogrenciler: MentorOgrenci[]): MentorTablo {
  const sirali = [...ogrenciler].sort((a, b) => a.full_name.localeCompare(b.full_name, 'tr'))
  const ozetler = sirali.map(o => dersOzeti(o.homeworks))
  const sutun = new Map<string, string>() // anahtar → ilk görülen görünen ad
  for (const oz of ozetler) for (const d of oz) if (!sutun.has(dersAnahtari(d.ders))) sutun.set(dersAnahtari(d.ders), d.ders)
  const anahtarlar = [...sutun.keys()].sort((a, b) => sutun.get(a)!.localeCompare(sutun.get(b)!, 'tr'))

  const satirlar = sirali.map((o, i) => {
    const m = new Map(ozetler[i].map(d => [dersAnahtari(d.ders), d]))
    const mazeretli = new Map<string, number>()
    for (const h of o.homeworks) if (h.status === 'mazeretli') mazeretli.set(dersAnahtari(h.subject), (mazeretli.get(dersAnahtari(h.subject)) ?? 0) + 1)
    return { id: o.id, full_name: o.full_name, class_name: o.class_name, dersler: ozetler[i], hucreler: anahtarlar.map(k => hucreMetni(m.get(k), mazeretli.get(k))) }
  })

  // /yonetim/odevler riskliler ile aynı eşik: yapılmadı + eksik toplamı
  const dikkat = sirali.flatMap(o => {
    const sayac = new Map<string, number>()
    for (const h of o.homeworks) {
      if (h.status === 'yapilmadi' || h.status === 'eksik') {
        const ad = h.subject.trim() || 'Diğer'
        sayac.set(ad, (sayac.get(ad) ?? 0) + 1)
      }
    }
    const toplam = [...sayac.values()].reduce((a, b) => a + b, 0)
    if (toplam < RISK_ESIGI) return []
    const dersler = [...sayac.entries()].sort(([a], [b]) => a.localeCompare(b, 'tr')).map(([d, n]) => `${d} ${n}`).join(', ')
    return [{ id: o.id, full_name: o.full_name, toplam, dersler }]
  })

  return { dersler: anahtarlar.map(k => sutun.get(k)!), satirlar, dikkat }
}

/** ?bas= ayrıştırma: yok/bozuk/2000 öncesi → dönem başı, ileri → bugün.
 *  Alt sınır: 0000-01-01 gibi değerleri Postgres reddeder, sayfa hata ekranına düşerdi. */
export function basTarihi(param: string | string[] | undefined, donemBasi: string, bugun: string): string {
  const v = Array.isArray(param) ? param[0] : param
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v) || v < '2000-01-01') return donemBasi
  const d = new Date(`${v}T00:00:00Z`)
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v) return donemBasi
  return v > bugun ? bugun : v
}
