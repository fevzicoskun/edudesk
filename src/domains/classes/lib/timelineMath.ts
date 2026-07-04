// Öğrenci 360 zaman çizelgesi: 7 kaynağı tek kronolojik akışta birleştiren saf mantık.
// Spec: docs/superpowers/specs/2026-07-04-ogrenci-360-design.md

export type TimelineKind =
  | 'devamsizlik' | 'odev' | 'not' | 'gorusme' | 'rehberlik' | 'veli_iletisim' | 'ogretmen_notu'

export interface TimelineEvent {
  date: string
  kind: TimelineKind
  label: string
}

export interface TimelineSources {
  attendance: { date: string; status: string }[]
  submissions: { status: string; dueDate: string | null; title: string | null }[]
  grades: { examDate: string | null; title: string; score: number | null; maxScore: number }[]
  meetings: { date: string; status: string; teacherName: string }[]
  mentorReports: { date: string }[]
  contactLogs: { date: string; method: string }[]
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
  for (const g of s.grades) {
    if (inWindow(g.examDate, windowStart)) {
      events.push({ date: g.examDate, kind: 'not', label: `"${g.title}": ${g.score ?? '—'}/${g.maxScore}` })
    }
  }
  for (const m of s.meetings) {
    if (m.status === 'iptal') continue
    if (inWindow(m.date, windowStart)) {
      const durum = m.status === 'yapildi' ? 'yapıldı' : 'planlandı'
      events.push({ date: m.date, kind: 'gorusme', label: `Veli görüşmesi (${durum}) — ${m.teacherName}` })
    }
  }
  for (const r of s.mentorReports) {
    if (inWindow(r.date, windowStart)) events.push({ date: r.date, kind: 'rehberlik', label: 'Rehberlik görüşmesi' })
  }
  for (const c of s.contactLogs) {
    if (inWindow(c.date, windowStart)) events.push({ date: c.date, kind: 'veli_iletisim', label: `Veli iletişimi (${c.method})` })
  }
  for (const n of s.studentNotes) {
    if (inWindow(n.date, windowStart)) {
      const body = n.body.length > 80 ? `${n.body.slice(0, 80)}…` : n.body
      events.push({ date: n.date, kind: 'ogretmen_notu', label: body })
    }
  }

  return events.sort((a, b) => b.date.localeCompare(a.date))
}
