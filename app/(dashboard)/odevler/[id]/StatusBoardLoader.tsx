import { createClient } from '@/src/infrastructure/supabase/server'
import { getClassWeekLoad } from '@/app/actions/homework'
import { format, parseISO } from '@/src/shared/date'
import type { ClassWeekLoad } from '@/src/domains/homework/lib/week-load'
import type { SubmissionStatus } from '@/src/shared/types'
import StatusBoard, { type StatusItem } from './StatusBoard'

interface Props {
  homeworkId: string
  classId: string
  dueDate: string | null
  schoolId: string
  homeworkTitle?: string
  className?: string
}

export default async function StatusBoardLoader({
  homeworkId,
  classId,
  dueDate,
  schoolId,
  homeworkTitle,
  className,
}: Props) {
  const supabase = await createClient()

  const [studentsResult, subsResult, otherHwRes, weekLoadResult] = await Promise.all([
    supabase
      .from('students')
      .select('id, full_name, student_number, veli_telefon, veli_ad, veli_email')
      .eq('class_id', classId)
      .eq('school_id', schoolId)
      .is('deleted_at', null)
      .limit(200),
    supabase
      .from('homework_submissions')
      .select('student_id, status, note')
      .eq('homework_id', homeworkId)
      .eq('school_id', schoolId),
    supabase
      .from('homeworks')
      .select('id')
      .eq('class_id', classId)
      .eq('school_id', schoolId)
      .is('deleted_at', null)
      .eq('is_template', false)
      .neq('id', homeworkId)
      .limit(200),
    dueDate
      ? getClassWeekLoad([classId], dueDate)
      : Promise.resolve([] as ClassWeekLoad[]),
  ])

  const weekLoad: ClassWeekLoad | null = weekLoadResult[0] ?? null
  const otherHomeworkIds = otherHwRes.data?.map(h => h.id) ?? []

  const cumulativeResult = otherHomeworkIds.length > 0
    ? await supabase
        .from('homework_submissions')
        .select('student_id, status, homework_id')
        .in('homework_id', otherHomeworkIds)
        .limit(12000)
    : { data: [] as { student_id: string; status: string; homework_id: string }[] }

  const students = studentsResult.data ?? []
  const subs     = subsResult.data ?? []
  const subMap   = new Map(subs.map(s => [s.student_id, s]))

  const cumulativeSubs     = cumulativeResult.data ?? []
  const totalHomeworkCount = new Set(cumulativeSubs.map(s => s.homework_id)).size
  const missedByStudent    = new Map<string, number>()
  for (const s of cumulativeSubs) {
    if (s.status === 'yapilmadi' || s.status === 'eksik') {
      missedByStudent.set(s.student_id, (missedByStudent.get(s.student_id) ?? 0) + 1)
    }
  }

  const items: StatusItem[] = students
    .map(student => {
      const sub = subMap.get(student.id)
      return {
        student_id:     student.id,
        full_name:      student.full_name,
        student_number: student.student_number,
        veli_telefon:   student.veli_telefon ?? null,
        veli_ad:        student.veli_ad ?? null,
        veli_email:     (student as typeof student & { veli_email?: string | null }).veli_email ?? null,
        status:         (sub?.status ?? 'yapilmadi') as SubmissionStatus,
        note:           sub?.note ?? null,
        hasRecord:      !!sub,
        missedCount:    missedByStudent.get(student.id) ?? 0,
        totalHomeworks: totalHomeworkCount,
      }
    })
    .sort((a, b) =>
      (a.student_number ?? '').localeCompare(b.student_number ?? '', 'tr', { numeric: true })
    )

  if (items.length === 0) {
    return (
      <p className="text-center text-gray-400 text-sm py-12">
        Bu sınıfta henüz öğrenci yok.
      </p>
    )
  }

  return (
    <StatusBoard
      homeworkId={homeworkId}
      items={items}
      homeworkTitle={homeworkTitle}
      totalHomeworks={totalHomeworkCount}
      classId={classId}
      dueDate={dueDate ? format(parseISO(dueDate), 'd MMMM yyyy') : ''}
      className={className}
      weekLoad={weekLoad}
    />
  )
}
