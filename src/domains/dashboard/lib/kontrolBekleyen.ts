// Müdür anasayfası "Erken Uyarılar": uzun süredir kontrol edilmemiş ödevler.
// Tanım Ödev Takibi ile aynı: hiç işaretli teslimi yok + referans (son teslim, yoksa veriliş) geçmiş.
// Eşik Ödev Takibi'nin kırmızısından (GECIKME_GUNU=3) bilerek uzun: anasayfada yalnız gerçekten unutulmuş olan.
export const KONTROL_UYARI_GUNU = 14
// ponytail: sorgu penceresi; daha eski ödevler artık kontrol edilmeyecek sayılır, Ödev Takibi'nde zaten görünür
export const KONTROL_UYARI_PENCERE = 60

export type KontrolBekleyenOgretmen = { id: string; odev: number; enEskiGun: number }

function gunFarki(once: string, sonra: string): number {
  const utc = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return Date.UTC(y, m - 1, d) }
  return Math.round((utc(sonra) - utc(once)) / 86_400_000)
}

/** isaretli = öğretmenin işaretlediği teslim sayısı; en uzun bekleten öğretmen önce */
export function kontrolBekleyenOzet(
  rows: { teacher_id: string; referans: string; isaretli: number }[],
  bugun: string,
): KontrolBekleyenOgretmen[] {
  const m = new Map<string, KontrolBekleyenOgretmen>()
  for (const r of rows) {
    const gun = gunFarki(r.referans, bugun)
    if (r.isaretli > 0 || gun <= KONTROL_UYARI_GUNU) continue
    const o = m.get(r.teacher_id) ?? { id: r.teacher_id, odev: 0, enEskiGun: 0 }
    o.odev++
    o.enEskiGun = Math.max(o.enEskiGun, gun)
    m.set(r.teacher_id, o)
  }
  return [...m.values()].sort((a, b) => b.enEskiGun - a.enEskiGun)
}
