import { createClient } from '@/src/infrastructure/supabase/server'
import { requireSchoolId } from '@/src/shared/auth'
import { subDays } from '@/src/shared/date'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default async function MudurOgretmenAktivite() {
  const supabase   = await createClient()
  const school_id  = await requireSchoolId()
  const weekAgoStr = subDays(new Date(), 7).toISOString().split('T')[0]

  const [profilesRes, attendanceRes, teacherClassesRes] = await Promise.all([
    supabase.from('profiles').select('id, full_name, subject, role')
      .eq('school_id', school_id)
      .in('role', ['ogretmen', 'zumre_baskani', 'mudur_yardimcisi']),
    supabase.from('attendance').select('class_id')
      .eq('school_id', school_id).gte('date', weekAgoStr),
    supabase.from('teacher_classes').select('teacher_id, class_id')
      .eq('school_id', school_id),
  ])

  const teachers   = profilesRes.data ?? []
  const classesWithAttendance = new Set((attendanceRes.data ?? []).map(a => a.class_id))

  const teacherClassMap = new Map<string, string[]>()
  for (const tc of teacherClassesRes.data ?? []) {
    if (!teacherClassMap.has(tc.teacher_id)) teacherClassMap.set(tc.teacher_id, [])
    teacherClassMap.get(tc.teacher_id)!.push(tc.class_id)
  }

  const withActivity = teachers
    .map(t => {
      const myClasses = teacherClassMap.get(t.id) ?? []
      const enteredAttendance = myClasses.length > 0 && myClasses.some(cid => classesWithAttendance.has(cid))
      return { ...t, hasClasses: myClasses.length > 0, enteredAttendance }
    })
    .filter(t => t.hasClasses) // sınıfı olmayan öğretmenler yoklama sorumluluğu taşımaz
    .sort((a, b) => {
      if (!a.enteredAttendance && b.enteredAttendance) return -1
      if (a.enteredAttendance && !b.enteredAttendance) return 1
      return (a.full_name ?? '').localeCompare(b.full_name ?? '', 'tr')
    })

  return (
    <Card className="border-gray-200 dark:border-slate-700 shadow-sm h-full">
      <CardHeader className="px-4 pt-4 pb-2">
        <CardTitle className="text-sm font-semibold text-gray-700 dark:text-slate-300">
          Öğretmen Yoklama Durumu
        </CardTitle>
        <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-0.5">Son 7 gün</p>
      </CardHeader>
      <CardContent className="p-0">
        <ul className="divide-y divide-gray-100 dark:divide-slate-700 max-h-96 overflow-y-auto">
          {withActivity.map(t => {
            const badge = t.enteredAttendance
              ? { label: 'Girdi', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300' }
              : { label: 'Girilmedi', cls: 'bg-red-100 text-red-600 dark:bg-red-950/60 dark:text-red-400' }
            return (
              <li key={t.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">
                    {t.full_name}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-slate-500 truncate">
                    {t.subject ?? '—'}
                  </p>
                </div>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${badge.cls}`}>
                  {badge.label}
                </span>
              </li>
            )
          })}
          {withActivity.length === 0 && (
            <li className="px-4 py-6 text-center text-sm text-gray-400 dark:text-slate-500">
              Sınıfa atanmış öğretmen yok.
            </li>
          )}
        </ul>
      </CardContent>
    </Card>
  )
}
