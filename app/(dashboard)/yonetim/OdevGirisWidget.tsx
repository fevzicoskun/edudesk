import { createClient } from '@/src/infrastructure/supabase/server'
import { requireSchoolId } from '@/src/shared/auth'
import { subDays } from '@/src/shared/date'

export default async function OdevGirisWidget() {
  const supabase  = await createClient()
  const school_id = await requireSchoolId()
  const since     = subDays(new Date(), 7).toISOString().split('T')[0]

  const [teachersRes, homeworksRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, subject')
      .eq('school_id', school_id)
      .in('role', ['ogretmen', 'zumre_baskani']),
    supabase
      .from('homeworks')
      .select('teacher_id')
      .eq('school_id', school_id)
      .gte('assigned_date', since)
      .is('deleted_at', null),
  ])

  const teachers     = teachersRes.data  ?? []
  const activeIds    = new Set((homeworksRes.data ?? []).map(h => h.teacher_id))
  const noHomework   = teachers.filter(t => !activeIds.has(t.id))
  const enteredCount = teachers.length - noHomework.length

  if (teachers.length === 0) return null

  const allGood = noHomework.length === 0

  return (
    <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-5 h-full">
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300">Son 7 Gün — Ödev Girişi</h2>
        <p className={`text-xs mt-0.5 ${allGood ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
          {allGood
            ? 'Tüm öğretmenler ödev girişi yaptı'
            : `${noHomework.length} öğretmen bu hafta ödev girmedi`}
        </p>
      </div>

      {/* Özet pill'ler */}
      <div className="flex gap-2 mb-4">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          {enteredCount} girdi
        </span>
        {noHomework.length > 0 && (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            {noHomework.length} girmedi
          </span>
        )}
      </div>

      {/* Girmeyenlerin listesi */}
      {noHomework.length > 0 && (
        <ul className="space-y-1.5">
          {noHomework.map(t => (
            <li key={t.id} className="flex items-center justify-between px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/40">
              <span className="text-sm font-medium text-gray-800 dark:text-slate-200 truncate">
                {t.full_name}
              </span>
              {t.subject && (
                <span className="text-xs text-gray-400 dark:text-slate-500 shrink-0 ml-2">
                  {t.subject}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {allGood && (
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
          <svg className="w-4 h-4 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          <span className="text-xs text-emerald-700 dark:text-emerald-300 font-medium">
            Bu hafta herkes ödev girişi yaptı
          </span>
        </div>
      )}
    </div>
  )
}
