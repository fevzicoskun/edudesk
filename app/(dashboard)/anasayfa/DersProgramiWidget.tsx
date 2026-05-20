import { createClient } from '@/src/infrastructure/supabase/server'
import { getCurrentUser } from '@/src/shared/auth'

type Schedule = {
  id: string
  schedule_type: 'resmi' | 'okul'
  type_label: string
  teacher_id: string | null
  class_id: string | null
  file_url: string | null
  file_name: string | null
  cls: { name: string; grade: number } | null
}

function isPdf(url: string) {
  const lower = url.toLowerCase()
  return lower.includes('.pdf') || lower.includes('%2fpdf') || lower.includes('pdf')
}

export default async function DersProgramiWidget() {
  const supabase = await createClient()
  const user = await getCurrentUser()
  if (!user) return null

  const [ownSchedulesRes, mentorClassesRes] = await Promise.all([
    supabase
      .from('lesson_schedules')
      .select('id, schedule_type, type_label, teacher_id, class_id, file_url, file_name')
      .eq('teacher_id', user.id)
      .not('file_url', 'is', null)
      .order('schedule_type'),
    supabase
      .from('classes')
      .select('id, name, grade')
      .eq('mentor_teacher_id', user.id),
  ])

  const mentorClasses = mentorClassesRes.data ?? []
  const mentorClassIds = mentorClasses.map((c: { id: string }) => c.id)
  const classMap = new Map<string, { name: string; grade: number }>()
  mentorClasses.forEach((c: { id: string; name: string; grade: number }) => classMap.set(c.id, c))

  // Mentor sınıflarının ders programları (sadece mentor ise)
  let mentorSchedulesData: typeof ownSchedulesRes.data = []
  if (mentorClassIds.length > 0) {
    const { data } = await supabase
      .from('lesson_schedules')
      .select('id, schedule_type, type_label, teacher_id, class_id, file_url, file_name')
      .in('class_id', mentorClassIds)
      .not('file_url', 'is', null)
      .order('schedule_type')
    mentorSchedulesData = data ?? []
  }

  // Birleştir, tekrarlananları at (öğretmen hem mentor hem öğretmen olabilir)
  const seen = new Set<string>()
  const schedulesRaw = [...(ownSchedulesRes.data ?? []), ...(mentorSchedulesData ?? [])].filter(s => {
    if (seen.has(s.id)) return false
    seen.add(s.id)
    return true
  })

  const schedules: Schedule[] = (schedulesRaw ?? []).map((s: {
    id: string; schedule_type: 'resmi' | 'okul'; type_label: string;
    teacher_id: string | null; class_id: string | null;
    file_url: string | null; file_name: string | null
  }) => ({
    ...s,
    cls: s.class_id ? classMap.get(s.class_id) ?? null : null,
  }))

  if (schedules.length === 0) {
    return (
      <section className="mt-4 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">Ders Programım</h2>
        <p className="text-xs text-gray-400 dark:text-slate-500">Henüz ders programınız eklenmemiş.</p>
      </section>
    )
  }

  return (
    <section className="mt-4 space-y-4">
      {schedules.map(s => (
        <div key={s.id} className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-slate-700">
            <div>
              <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300">
                {s.class_id && s.cls
                  ? `Ders Programım — ${s.cls.grade}. Sınıf ${s.cls.name}`
                  : 'Ders Programım'}
              </h2>
              <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded-full font-semibold mt-0.5 ${
                s.schedule_type === 'resmi'
                  ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                  : 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
              }`}>
                {s.type_label}
              </span>
            </div>
            {s.file_url && (
              <a href={s.file_url} target="_blank" rel="noopener noreferrer"
                className="text-xs text-blue-600 dark:text-blue-400 font-medium hover:underline">
                Tam Ekran ↗
              </a>
            )}
          </div>
          {s.file_url && (
            isPdf(s.file_url) ? (
              <iframe
                src={s.file_url}
                className="w-full border-0"
                style={{ height: '600px' }}
                title="Ders Programı"
              />
            ) : (
              <div className="p-3">
                <img src={s.file_url} alt="Ders Programı" className="w-full rounded-lg object-contain" style={{ maxHeight: '600px' }} />
              </div>
            )
          )}
        </div>
      ))}
    </section>
  )
}
