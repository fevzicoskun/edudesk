import { dersOzeti, dersAnahtari, type DersOzeti, type HomeworkRecord } from '@/src/domains/homework/lib/stats'
import { odevSeviyesi } from '@/src/domains/classes/lib/genelDurum'
import { RISK_ESIGI } from '@/src/domains/homework/lib/odev-takibi'

export type MentorOgrenci = { id: string; full_name: string; class_name: string | null; homeworks: HomeworkRecord[] }
export type MentorHucre = { metin: string; kirmizi: boolean }
export type MentorSatir = { id: string; full_name: string; class_name: string | null; hucreler: MentorHucre[]; dersler: DersOzeti[] }
export type DikkatSatiri = { id: string; full_name: string; toplam: number; dersler: string }
export type MentorTablo = { dersler: string[]; satirlar: MentorSatir[]; dikkat: DikkatSatiri[] }

/** "4/5", eksik varsa "2/3 (1e)". Pay/payda dersOzeti ile aynı (mazeretli + kontrol edilmemiş paydada yok). */
export function hucreMetni(d: DersOzeti | undefined): MentorHucre {
  if (!d || d.degerlendirilen === 0) return { metin: '—', kirmizi: false }
  const oran = Math.round((d.yapildi / d.degerlendirilen) * 100)
  return {
    metin: `${d.yapildi}/${d.degerlendirilen}${d.eksik ? ` (${d.eksik}e)` : ''}`,
    kirmizi: odevSeviyesi(d.degerlendirilen, oran) === 'risk',
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
    return { id: o.id, full_name: o.full_name, class_name: o.class_name, dersler: ozetler[i], hucreler: anahtarlar.map(k => hucreMetni(m.get(k))) }
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
