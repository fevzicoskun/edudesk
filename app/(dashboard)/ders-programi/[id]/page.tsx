import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/src/shared/auth'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import DersProgramiEditorClient from './DersProgramiEditorClient'

type Slot = { day: number; period: number; subject: string }

export default async function DersProgramiEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const user = await getCurrentUser()
  if (!user) return null

  const { data: schedule } = await supabase
    .from('lesson_schedules')
    .select('id, schedule_type, type_label, teacher_id, class_id, title, slots, period_count')
    .eq('id', id)
    .single()

  if (!schedule) notFound()

  let ownerName = schedule.title ?? ''
  let ownerSubtitle = ''

  if (schedule.teacher_id) {
    const { data: t } = await supabase
      .from('profiles').select('full_name, subject').eq('id', schedule.teacher_id).single()
    ownerName = t?.full_name ?? 'Öğretmen'
    ownerSubtitle = t?.subject ?? ''
  } else if (schedule.class_id) {
    const { data: c } = await supabase
      .from('classes').select('name, grade').eq('id', schedule.class_id).single()
    ownerName = c ? `${c.grade}. Sınıf — ${c.name}` : 'Sınıf'
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/ders-programi" className="text-sm text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300">
              ← Ders Programları
            </Link>
          </div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">{ownerName}</h1>
          {ownerSubtitle && <p className="text-sm text-gray-500 dark:text-slate-400">{ownerSubtitle}</p>}
          <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full font-medium ${
            schedule.schedule_type === 'resmi'
              ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
              : 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
          }`}>
            {schedule.type_label}
          </span>
        </div>
      </div>

      <DersProgramiEditorClient
        scheduleId={schedule.id}
        initialSlots={(schedule.slots ?? []) as Slot[]}
        initialPeriodCount={schedule.period_count ?? 8}
      />
    </div>
  )
}
