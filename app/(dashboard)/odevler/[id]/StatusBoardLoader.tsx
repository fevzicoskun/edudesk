import { createClient } from '@/src/infrastructure/supabase/server'
import { getClassWeekLoad } from '@/app/actions/homework'
import { format, parseISO, formatIstanbulGun } from '@/src/shared/date'
import type { ClassWeekLoad } from '@/src/domains/homework/lib/week-load'
import type { SubmissionStatus } from '@/src/shared/types'
import StatusBoard, { type StatusItem } from './StatusBoard'
import { fetchAllResult } from '@/src/shared/utils/fetchAll'
import { donemBasi } from '@/src/shared/utils'
import { oncekiSayilar } from '@/src/domains/homework/lib/odev-rapor'

interface Props {
  homeworkId: string
  classId: string
  /** Ödevin sahibi — raporun "kaçıncı kez" sayımı bu öğretmenin ödevleriyle sınırlı */
  teacherId: string
  dueDate: string | null
  /** Ödevin verildiği gün — yazdırma raporunda gösterilir */
  assignedDate?: string | null
  schoolId: string
  homeworkTitle?: string
  className?: string
  readOnly?: boolean
  okulAdi?: string
  ders?: string
  ogretmenAdi?: string
}

export default async function StatusBoardLoader({
  homeworkId,
  classId,
  teacherId,
  dueDate,
  assignedDate = null,
  schoolId,
  homeworkTitle,
  className,
  readOnly = false,
  okulAdi = '',
  ders = '',
  ogretmenAdi = '',
}: Props) {
  const supabase = await createClient()

  const [studentsResult, subsResult, cumulativeRes, weekLoadResult, oncekiRes] = await Promise.all([
    supabase
      .from('students')
      .select('id, full_name, student_number, veli_telefon, veli_ad, veli_email')
      .eq('class_id', classId)
      .eq('school_id', schoolId)
      .is('deleted_at', null)
      .limit(200),
    supabase
      .from('homework_submissions')
      .select('student_id, status, note, marked_at')
      .eq('homework_id', homeworkId)
      .eq('school_id', schoolId),
    // Sınıfın diğer ödevlerindeki kümülatif yük — öğrenci başına kaçırılan +
    // toplam ödev sayısı DB'de agregat (eski ham .limit(12000) yerine).
    supabase.rpc('get_class_cumulative_load', {
      p_class_id: classId,
      p_school_id: schoolId,
      p_exclude_homework: homeworkId,
    }),
    dueDate
      ? getClassWeekLoad([classId], dueDate)
      : Promise.resolve([] as ClassWeekLoad[]),
    // Yazdırma raporu "4. kez": bu dönem, bu öğretmenin bu sınıfa verdiği DİĞER ödevlerde
    // işaretlenmiş yapılmadı/eksikler. Otomatik açılan satırlar varsayılan 'yapilmadi' → marked_at şart.
    fetchAllResult<{ student_id: string; status: string }>((from, to) =>
      supabase
        .from('homework_submissions')
        .select('student_id, status, homeworks!inner(id)')
        .eq('school_id', schoolId)
        .in('status', ['yapilmadi', 'eksik'])
        .not('marked_at', 'is', null)
        .neq('homework_id', homeworkId)
        .eq('homeworks.class_id', classId)
        .eq('homeworks.teacher_id', teacherId)
        .eq('homeworks.is_template', false)
        .is('homeworks.deleted_at', null)
        .gte('homeworks.assigned_date', donemBasi())
        .order('id')
        .range(from, to)),
  ])
  // Tamamlayıcı bilgi: okunamazsa rapor sayısız basılır (yanlış sayı basmaktan iyidir)
  if (oncekiRes.error) console.error('[StatusBoardLoader] önceki sayılar okunamadı:', oncekiRes.error.message)
  const onceki = oncekiSayilar(oncekiRes.data ?? [])

  const weekLoad: ClassWeekLoad | null = weekLoadResult[0] ?? null

  const students = studentsResult.data ?? []
  const subs     = subsResult.data ?? []
  const subMap   = new Map(subs.map(s => [s.student_id, s]))

  // Raporun "kontrol edildiği tarih"i: öğretmenin son işaretlemesi
  const sonKontrol = subs.reduce<string | null>(
    (en, s) => (s.marked_at && (!en || s.marked_at > en) ? s.marked_at : en), null)

  const cumulativeRows     = cumulativeRes.data ?? []
  const totalHomeworkCount = Number(cumulativeRows[0]?.total_homeworks ?? 0)
  const missedByStudent    = new Map(cumulativeRows.map(r => [r.student_id, Number(r.missed)]))

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
        // Trigger her öğrenciye satır açıyor; işaretlenmiş SAYILMAK için marked_at şart
        hasRecord:      !!sub?.marked_at,
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
      verilisTarihi={assignedDate ? format(parseISO(assignedDate), 'd MMMM yyyy') : ''}
      kontrolTarihi={sonKontrol ? formatIstanbulGun(sonKontrol) : ''}
      className={className}
      weekLoad={weekLoad}
      readOnly={readOnly}
      okulAdi={okulAdi}
      ders={ders}
      ogretmenAdi={ogretmenAdi}
      onceki={onceki}
    />
  )
}
