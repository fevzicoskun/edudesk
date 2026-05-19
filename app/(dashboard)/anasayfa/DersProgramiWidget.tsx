import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/src/shared/auth'

type Slot = { day: number; period: number; subject: string }
type Schedule = {
  id: string
  schedule_type: 'resmi' | 'okul'
  type_label: string
  teacher_id: string | null
  class_id: string | null
  slots: Slot[]
  period_count: number
  cls: { name: string; grade: number } | null
}

const DAYS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum']

function ScheduleGrid({ slots, periodCount }: { slots: Slot[]; periodCount: number }) {
  const map: Record<string, string> = {}
  slots.forEach(s => { map[`${s.day}-${s.period}`] = s.subject })
  const periods = Array.from({ length: periodCount }, (_, i) => i + 1)

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse min-w-[340px]">
        <thead>
          <tr>
            <th className="py-1 px-1 text-left text-[10px] font-semibold text-gray-400 dark:text-slate-500 w-14" />
            {DAYS.map(d => (
              <th key={d} className="py-1 px-1 text-center text-[10px] font-semibold text-gray-500 dark:text-slate-400">{d}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {periods.map(p => (
            <tr key={p} className="border-t border-gray-100 dark:border-slate-700">
              <td className="py-1 px-1 text-[10px] text-gray-400 dark:text-slate-500 font-medium">{p}.</td>
              {[1, 2, 3, 4, 5].map(d => {
                const val = map[`${d}-${p}`]
                return (
                  <td key={d} className="py-1 px-1 text-center">
                    {val ? (
                      <span className="inline-block bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 rounded px-1 py-0.5 text-[10px] leading-tight max-w-[60px] truncate">{val}</span>
                    ) : (
                      <span className="text-gray-200 dark:text-slate-700">—</span>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default async function DersProgramiWidget() {
  const supabase = await createClient()
  const user = await getCurrentUser()
  if (!user) return null

  const { data: profileData } = await supabase
    .from('profiles').select('school_id').eq('id', user.id).single()

  const { data: mentorClasses } = await supabase
    .from('classes').select('id, name, grade').eq('mentor_teacher_id', user.id)

  const mentorClassIds = (mentorClasses ?? []).map((c: { id: string }) => c.id)

  const { data: schedulesRaw } = await supabase
    .from('lesson_schedules')
    .select('id, schedule_type, type_label, teacher_id, class_id, slots, period_count')
    .or(
      mentorClassIds.length > 0
        ? `teacher_id.eq.${user.id},class_id.in.(${mentorClassIds.join(',')})`
        : `teacher_id.eq.${user.id}`
    )
    .order('schedule_type')

  if (!schedulesRaw || schedulesRaw.length === 0) return null

  const classMap = new Map<string, { name: string; grade: number }>()
  ;(mentorClasses ?? []).forEach((c: { id: string; name: string; grade: number }) => classMap.set(c.id, c))

  const schedules: Schedule[] = schedulesRaw.map((s: {
    id: string; schedule_type: 'resmi' | 'okul'; type_label: string;
    teacher_id: string | null; class_id: string | null;
    slots: Slot[]; period_count: number
  }) => ({
    ...s,
    cls: s.class_id ? classMap.get(s.class_id) ?? null : null,
  }))

  return (
    <section className="mt-4 space-y-4">
      {schedules.map(s => (
        <div
          key={s.id}
          className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4"
        >
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300">
              {s.class_id && s.cls
                ? `Ders Programım — ${s.cls.grade}. Sınıf ${s.cls.name}`
                : 'Ders Programım'}
            </h2>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
              s.schedule_type === 'resmi'
                ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                : 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
            }`}>
              {s.type_label}
            </span>
          </div>
          {s.slots.length > 0 ? (
            <ScheduleGrid slots={s.slots as Slot[]} periodCount={s.period_count} />
          ) : (
            <p className="text-xs text-gray-400 dark:text-slate-500 text-center py-3">Program henüz girilmemiş.</p>
          )}
        </div>
      ))}
    </section>
  )
}
