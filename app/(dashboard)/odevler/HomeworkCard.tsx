import { deleteHomework } from '@/src/domains/homework/actions'
import SwipeableHomeworkCard from './SwipeableHomeworkCard'
import type { HW, StatusCounts } from './types'

export default function HomeworkCard({ hw, overdue, canWrite, statusMap, classStudentMap }: {
  hw: HW
  overdue: boolean
  canWrite: boolean
  statusMap: Map<string, StatusCounts>
  classStudentMap: Map<string, number>
}) {
  const cls     = hw.classes as { name: string } | null
  const teacher = (hw as HW & { teacher?: { full_name: string } | null }).teacher

  function dueDateStr(due: string | null) {
    if (!due) return '—'
    try {
      return new Date(due + 'T12:00:00').toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })
    } catch { return due }
  }

  return (
    <SwipeableHomeworkCard
      id={hw.id}
      title={hw.title}
      subject={hw.subject}
      className={cls?.name ?? '—'}
      dueDateStr={dueDateStr(hw.due_date)}
      dueDate={hw.due_date}
      overdue={overdue}
      description={hw.description ?? undefined}
      teacherName={(teacher as { full_name: string } | null | undefined)?.full_name ?? undefined}
      canWrite={canWrite}
      statusCounts={statusMap.get(hw.id)}
      totalStudents={classStudentMap.get(hw.class_id as string) ?? 0}
      onDelete={deleteHomework.bind(null, hw.id)}
    />
  )
}
