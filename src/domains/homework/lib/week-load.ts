export type WeekLoadItem = {
  subject: string
  dueDate: string
  teacherName: string
  isOwn: boolean
}

export type ClassWeekLoad = {
  classId: string
  className: string
  count: number
  items: WeekLoadItem[]
  level: 'ok' | 'warn' | 'danger'
}

export function weekRange(dateStr: string): { start: string; end: string } {
  const [year, month, day] = dateStr.split('-').map(Number)
  const d = new Date(year, month - 1, day)
  const dow = d.getDay()                    // 0=Pazar
  const toMonday = dow === 0 ? -6 : 1 - dow
  const monday = new Date(year, month - 1, day + toMonday)
  const sunday = new Date(year, month - 1, day + toMonday + 6)
  const pad = (n: number) => String(n).padStart(2, '0')
  const fmt = (dt: Date) =>
    `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`
  return { start: fmt(monday), end: fmt(sunday) }
}

export function buildClassWeekLoad(
  rawItems: { subject: string; due_date: string; teacher_id: string; teacher_name: string }[],
  classId: string,
  className: string,
  ownTeacherId: string,
): ClassWeekLoad {
  const items: WeekLoadItem[] = rawItems
    .map(r => ({
      subject: r.subject,
      dueDate: r.due_date,
      teacherName: r.teacher_name,
      isOwn: r.teacher_id === ownTeacherId,
    }))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  const count = items.length
  return {
    classId,
    className,
    count,
    items,
    level: count >= 5 ? 'danger' : count >= 3 ? 'warn' : 'ok',
  }
}
