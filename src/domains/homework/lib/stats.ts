import type { SubmissionStatus } from '@/src/shared/types'

export type HomeworkRecord = {
  id: string
  title: string
  subject: string
  due_date: string | null
  /** null = öğretmen henüz işaretlemedi (kontrol edilmedi) */
  status: SubmissionStatus | null
  note: string | null
  /** ödevi veren — öğrenci sayfasında satırın açılabilirliği (kapsam) için */
  teacher_id: string
}

export type StudentHomeworkStats = {
  total: number
  yapildi: number
  eksik: number
  yapilmadi: number
  gec: number
  mazeretli: number
  kontrolEdilmedi: number
  completionRate: number
}

export function computeStudentHomeworkStats(homeworks: HomeworkRecord[]): StudentHomeworkStats {
  const counts = { yapildi: 0, eksik: 0, yapilmadi: 0, gec: 0, mazeretli: 0, kontrolEdilmedi: 0 }
  for (const hw of homeworks) {
    counts[hw.status ?? 'kontrolEdilmedi']++
  }
  const eligible = homeworks.length - counts.mazeretli - counts.kontrolEdilmedi
  const completionRate = eligible === 0 ? 0 : Math.round((counts.yapildi / eligible) * 100)
  return { total: homeworks.length, ...counts, completionRate }
}

export type DersOzeti = { ders: string; yapildi: number; eksik: number; gec: number; degerlendirilen: number; toplam: number }

/** Ders bazlı durum. "yapildi / degerlendirilen" completionRate ile aynı tanım:
 *  mazeretli ve kontrol edilmemiş ödev paydaya girmez. Ders adı harf/boşluk farkıyla bölünmez. */
export function dersOzeti(homeworks: HomeworkRecord[]): DersOzeti[] {
  const m = new Map<string, DersOzeti>()
  for (const hw of homeworks) {
    const ad = hw.subject.trim() || 'Diğer'
    const anahtar = ad.toLocaleLowerCase('tr-TR')
    const d = m.get(anahtar) ?? { ders: ad, yapildi: 0, eksik: 0, gec: 0, degerlendirilen: 0, toplam: 0 }
    d.toplam++
    if (hw.status && hw.status !== 'mazeretli') d.degerlendirilen++
    if (hw.status === 'yapildi') d.yapildi++
    if (hw.status === 'eksik') d.eksik++
    if (hw.status === 'gec') d.gec++
    m.set(anahtar, d)
  }
  return [...m.values()].sort((a, b) => a.ders.localeCompare(b.ders, 'tr'))
}

/** "Matematik 2/3 (1 eksik)" — öğrenci sayfası ve yazdırılabilir özetin ORTAK metni (iki ekran ayrışmasın).
 *  Eksik/geç paya girmez ama görünür kalır: "2/3" okuyan "biri hiç yapılmamış" sanmasın (2026-09-28). */
export function dersOzetiMetni(d: DersOzeti): string {
  if (d.degerlendirilen === 0) return `${d.ders} —`
  const ek = [d.eksik && `${d.eksik} eksik`, d.gec && `${d.gec} geç`].filter(Boolean).join(', ')
  return `${d.ders} ${d.yapildi}/${d.degerlendirilen}${ek ? ` (${ek})` : ''}`
}

type OdevSatiri = { id: string; title: string; subject: string; due_date: string | null; teacher_id: string }
type TeslimSatiri = { homework_id: string; student_id: string; status: string; note: string | null }

/** Sınıfın ödevlerini + işaretli teslimleri öğrenci başına HomeworkRecord listesine çevirir.
 *  Teslimi olmayan ödev status=null ("kontrol edilmedi") — "yapılmadı" DEĞİL. */
export function sinifOdevKayitlari(
  ogrenciIds: string[],
  odevler: OdevSatiri[],
  teslimler: TeslimSatiri[],
): Map<string, HomeworkRecord[]> {
  const teslim = new Map(teslimler.map(t => [`${t.student_id}:${t.homework_id}`, t]))
  return new Map(ogrenciIds.map(sid => [sid, odevler.map(hw => {
    const t = teslim.get(`${sid}:${hw.id}`)
    return {
      id: hw.id, title: hw.title, subject: hw.subject, due_date: hw.due_date, teacher_id: hw.teacher_id,
      status: (t?.status ?? null) as SubmissionStatus | null,
      note: t?.note ?? null,
    }
  })]))
}
