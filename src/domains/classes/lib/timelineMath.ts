// Öğrenci 360 zaman çizelgesi: kaynakları tek kronolojik akışta birleştiren saf mantık.
// Veli randevuları, veli iletişim kayıtları, not geçmişi ve rehberlik görüşmeleri kaldırıldı
// (2026-10-17, hiç kullanılmadı; görüşmeler Metodbox'ta).
// Spec: docs/superpowers/specs/2026-07-04-ogrenci-360-design.md

export type TimelineKind =
  | 'devamsizlik' | 'odev' | 'ogretmen_notu'

export interface TimelineEvent {
  date: string
  kind: TimelineKind
  label: string
}

export interface TimelineSources {
  attendance: { date: string; status: string }[]
  submissions: { status: string; dueDate: string | null; title: string | null }[]
  studentNotes: { date: string; body: string }[]
}

const ATTENDANCE_LABEL: Record<string, string> = {
  absent: 'Devamsız', late: 'Geç geldi', excused: 'Özürlü',
}
const SUBMISSION_LABEL: Record<string, string> = {
  yapilmadi: 'yapılmadı', eksik: 'eksik', gec: 'geç teslim edildi',
}

// Geçerli ve pencere içinde mi? Timestamp'ler gün bazında karşılaştırılır.
function inWindow(date: string | null | undefined, windowStart: string): date is string {
  if (!date) return false
  if (Number.isNaN(new Date(date).getTime())) return false
  return date.slice(0, 10) >= windowStart
}

export function buildStudentTimeline(s: TimelineSources, windowStart: string): TimelineEvent[] {
  const events: TimelineEvent[] = []

  for (const a of s.attendance) {
    const label = ATTENDANCE_LABEL[a.status]
    if (label && inWindow(a.date, windowStart)) events.push({ date: a.date, kind: 'devamsizlik', label })
  }
  for (const sub of s.submissions) {
    const label = SUBMISSION_LABEL[sub.status]
    if (label && inWindow(sub.dueDate, windowStart)) {
      events.push({ date: sub.dueDate, kind: 'odev', label: `"${sub.title ?? '?'}" ödevi ${label}` })
    }
  }
  for (const n of s.studentNotes) {
    if (inWindow(n.date, windowStart)) {
      const body = n.body.length > 80 ? `${n.body.slice(0, 80)}…` : n.body
      events.push({ date: n.date, kind: 'ogretmen_notu', label: body })
    }
  }

  return events.sort((a, b) => b.date.localeCompare(a.date))
}
