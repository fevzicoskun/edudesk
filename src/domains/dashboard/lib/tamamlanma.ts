import type { SubmissionStatus } from '@/src/shared/types'
import type { OdevTamamlanmaItem } from '@/src/domains/dashboard/types'

type Hw  = { id: string; title: string; due_date: string; class_id: string; classes: { name: string } | null }
type Sub = { homework_id: string; status: string }

const SINIF_BASINA = 6

/** Ana sayfa "Ödev Tamamlanma": teslimi gelmiş ödevler, en yeni üstte, sınıf başına en fazla 6.
 *  submissions yalnız İŞARETLİ satırlar olmalı (marked_at dolu) — isaretli 0 = henüz kontrol edilmedi.
 *  Her durum ayrı sayılır: eskiden geç/mazeretli "Yapılmadı" diliminde kırmızı görünüyordu. */
export function tamamlanmaSatirlari(homeworks: Hw[], submissions: Sub[], bugun: string): OdevTamamlanmaItem[] {
  const sinifSayisi = new Map<string, number>()
  const secilen = homeworks
    .filter(h => h.due_date <= bugun)
    .sort((a, b) => b.due_date.localeCompare(a.due_date))
    .filter(h => {
      const n = sinifSayisi.get(h.class_id) ?? 0
      sinifSayisi.set(h.class_id, n + 1)
      return n < SINIF_BASINA
    })

  const sayimlar = new Map(secilen.map(h => [h.id, { yapildi: 0, gec: 0, eksik: 0, yapilmadi: 0, mazeretli: 0 } as Record<SubmissionStatus, number>]))
  for (const s of submissions) {
    const sayim = sayimlar.get(s.homework_id)
    if (sayim && s.status in sayim) sayim[s.status as SubmissionStatus]++
  }

  return secilen.map(h => {
    const sayim = sayimlar.get(h.id)!
    return {
      id:        h.id,
      title:     h.title,
      classId:   h.class_id,
      className: h.classes?.name ?? '—',
      dueDate:   h.due_date,
      sayim,
      isaretli:  Object.values(sayim).reduce((a, b) => a + b, 0),
    }
  })
}
