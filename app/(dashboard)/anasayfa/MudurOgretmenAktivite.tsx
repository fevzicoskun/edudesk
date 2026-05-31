import { createClient } from '@/src/infrastructure/supabase/server'
import { requireSchoolId } from '@/src/shared/auth'
import { subDays } from '@/src/shared/date'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

function getWeekRange(): { from: string; label: string; isWeekend: boolean } {
  const now = new Date()
  const dow = now.getDay()
  const isWeekend = dow === 0 || dow === 6
  const daysBack = isWeekend ? (dow === 6 ? 6 : 7) : 7
  const from = subDays(now, daysBack).toISOString().split('T')[0]
  return { from, label: isWeekend ? 'Geçen hafta' : 'Son 7 gün', isWeekend }
}

function Dot({ ok }: { ok: boolean }) {
  return (
    <span className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${ok ? 'bg-emerald-500' : 'bg-red-400'}`} />
  )
}

export default async function MudurOgretmenAktivite() {
  const supabase  = await createClient()
  const school_id = await requireSchoolId()
  const { from: weekAgoStr, label: periodLabel, isWeekend } = getWeekRange()

  const [profilesRes, homeworksRes, attendanceRes] = await Promise.all([
    supabase.from('profiles').select('id, full_name, subject, role')
      .eq('school_id', school_id)
      .in('role', ['ogretmen', 'zumre_baskani']),
    supabase.from('homeworks').select('teacher_id')
      .eq('school_id', school_id)
      .gte('assigned_date', weekAgoStr)
      .is('deleted_at', null),
    supabase.from('attendance').select('teacher_id')
      .eq('school_id', school_id)
      .gte('date', weekAgoStr),
  ])

  const teachers             = profilesRes.data ?? []
  const teachersWithHomework = new Set((homeworksRes.data ?? []).map(h => h.teacher_id))
  const teachersWithAtt      = new Set((attendanceRes.data ?? []).map(a => a.teacher_id))

  const rows = teachers
    .map(t => ({
      ...t,
      hasHomework:   teachersWithHomework.has(t.id),
      hasAttendance: teachersWithAtt.has(t.id),
    }))
    .sort((a, b) => {
      // En üste: ikisi de eksik
      const scoreA = (a.hasHomework ? 1 : 0) + (a.hasAttendance ? 1 : 0)
      const scoreB = (b.hasHomework ? 1 : 0) + (b.hasAttendance ? 1 : 0)
      if (scoreA !== scoreB) return scoreA - scoreB
      return (a.full_name ?? '').localeCompare(b.full_name ?? '', 'tr')
    })

  const inactiveCount = rows.filter(t => !t.hasHomework && !t.hasAttendance).length

  return (
    <Card className="border-gray-200 dark:border-slate-700 shadow-sm h-full">
      <CardHeader className="px-4 pt-4 pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-sm font-semibold text-gray-700 dark:text-slate-300">
              Öğretmen Aktivitesi
            </CardTitle>
            <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-0.5">{periodLabel}</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {isWeekend && (
              <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-full">
                Hafta sonu
              </span>
            )}
            {inactiveCount > 0 && (
              <span className="text-[10px] font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 px-2 py-0.5 rounded-full">
                {inactiveCount} pasif
              </span>
            )}
          </div>
        </div>
        {/* Kolon başlıkları */}
        <div className="flex items-center justify-end gap-4 mt-2 pr-1">
          <span className="text-[10px] font-medium text-gray-400 dark:text-slate-500 w-12 text-center">Ödev</span>
          <span className="text-[10px] font-medium text-gray-400 dark:text-slate-500 w-14 text-center">Yoklama</span>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ul className="divide-y divide-gray-100 dark:divide-slate-700 max-h-96 overflow-y-auto">
          {rows.map(t => (
            <li key={t.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">{t.full_name}</p>
                <p className="text-xs text-gray-400 dark:text-slate-500 truncate">{t.subject ?? '—'}</p>
              </div>
              <div className="flex items-center gap-4 shrink-0">
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full w-12 text-center ${
                  t.hasHomework
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                    : 'bg-red-100 text-red-600 dark:bg-red-950/60 dark:text-red-400'
                }`}>
                  {t.hasHomework ? 'Girdi' : 'Girmedi'}
                </span>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full w-14 text-center ${
                  t.hasAttendance
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                    : 'bg-red-100 text-red-600 dark:bg-red-950/60 dark:text-red-400'
                }`}>
                  {t.hasAttendance ? 'Aldı' : 'Almadı'}
                </span>
              </div>
            </li>
          ))}
          {rows.length === 0 && (
            <li className="px-4 py-6 text-center text-sm text-gray-400 dark:text-slate-500">
              Henüz öğretmen yok.
            </li>
          )}
        </ul>
      </CardContent>
    </Card>
  )
}
