export const SON_ODEV_SAYISI = 5

/** Sınıf detayındaki "Son 5 ödev: X eksik" — öğrencinin İŞARETLİ en yeni SON_ODEV_SAYISI ödevi.
 *  odevIds teslim tarihi yeniden eskiye sıralı; subs yalnız marked_at dolu satırlar.
 *  Yapılmadı ve eksik "eksik" sayılır, geç sayılmaz; mazeretli (sınıfta yok) pencereye girmez. */
export function sonOdevEksik(
  odevIds: string[],
  subs: { homework_id: string; student_id: string; status: string }[],
): Map<string, { bakilan: number; eksik: number }> {
  const sira = new Map(odevIds.map((id, i) => [id, i]))
  const ogrenci = new Map<string, { sira: number; status: string }[]>()
  for (const s of subs) {
    const i = sira.get(s.homework_id)
    if (i === undefined || s.status === 'mazeretli') continue
    ogrenci.set(s.student_id, [...(ogrenci.get(s.student_id) ?? []), { sira: i, status: s.status }])
  }
  const sonuc = new Map<string, { bakilan: number; eksik: number }>()
  for (const [id, liste] of ogrenci) {
    const son = liste.sort((a, b) => a.sira - b.sira).slice(0, SON_ODEV_SAYISI)
    sonuc.set(id, { bakilan: son.length, eksik: son.filter(d => d.status === 'yapilmadi' || d.status === 'eksik').length })
  }
  return sonuc
}
