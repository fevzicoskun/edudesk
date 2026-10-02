import { turkeyDate } from '@/src/lib/email-utils'

/** Tercihini hiç kaydetmemiş öğretmenin varsayılanı — ayarlar ekranı da bunu gösterir (tek kaynak). */
export const VARSAYILAN_TERCIH = { days_before: 1, email_on: true } as const

type Tercih = { days_before: number; email_on: boolean }
type Odev = { id: string; title: string; due_date: string; school_id: string; teacher_id: string; class_id: string }

/** Bugün hatırlatması gidecek ödevler. 2026-10-03: tercih satırı olmayan öğretmen ATLANIYORDU
 *  (9 gerçek öğretmenin 6'sı hiç hatırlatma almıyordu, ekran "açık" gösterirken) → artık varsayılan. */
export function hatirlatmaAdaylari(
  homeworks: Odev[],
  prefMap: Map<string, Tercih>,
  emailMap: Map<string, string>,
) {
  return homeworks.flatMap((hw) => {
    const pref = prefMap.get(hw.teacher_id) ?? VARSAYILAN_TERCIH

    const targetDate = new Date()
    targetDate.setDate(targetDate.getDate() + pref.days_before)
    if (hw.due_date.slice(0, 10) !== turkeyDate(targetDate)) return []

    return [{
      homeworkId:   hw.id,
      classId:      hw.class_id,
      title:        hw.title,
      dueDate:      hw.due_date.slice(0, 10),
      schoolId:     hw.school_id,
      teacherId:    hw.teacher_id,
      teacherEmail: emailMap.get(hw.teacher_id) ?? '',
      emailOn:      pref.email_on,
      daysBefore:   pref.days_before,
    }]
  })
}
