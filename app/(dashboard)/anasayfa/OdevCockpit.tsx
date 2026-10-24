import Link from 'next/link'
import { createClient } from '@/src/infrastructure/supabase/server'
import { getCurrentUser } from '@/src/shared/auth'
import { addDaysISO, format, parseISO, todayLocalISO } from '@/src/shared/date'
import { kategorizeOdev } from '@/src/domains/homework/homeworkMath'
import { PENDING_REVIEW_DAYS } from '@/src/shared/constants/limits'

/** Ana sayfa "Kontrol bekliyor": öğretmenin KENDİ ödevlerinden Ödevler sayfasındaki "Kontrol bekliyor"
 *  sütununa düşenler (kategorizeOdev — aynı kural). Boşsa kart hiç çizilmez. */
export default async function OdevCockpit({ schoolId }: { schoolId: string }) {
  const user = await getCurrentUser()
  if (!user) return null

  const supabase = await createClient()
  const today = todayLocalISO()

  const { data } = await supabase
    .from('homeworks')
    .select('id, title, due_date, class_id, classes(name), homework_submissions(marked_at)')
    .eq('teacher_id', user.id)
    .eq('school_id', schoolId)
    .eq('is_template', false)
    .is('deleted_at', null)
    .lt('due_date', today)
    .gte('due_date', addDaysISO(today, -PENDING_REVIEW_DAYS)) // pencere dışı kategorizeOdev'de zaten 'gecmis'
    .order('due_date', { ascending: false })

  const odevler = data ?? []
  if (odevler.length === 0) return null

  const classIds = [...new Set(odevler.map(h => h.class_id))]
  const { data: ogrenciler } = await supabase
    .from('students').select('class_id').in('class_id', classIds).eq('school_id', schoolId).is('deleted_at', null)
  const mevcut = new Map<string, number>()
  for (const s of ogrenciler ?? []) mevcut.set(s.class_id, (mevcut.get(s.class_id) ?? 0) + 1)

  const now = new Date()
  const bekleyen = odevler.flatMap(hw => {
    // Satırlar ödevle otomatik açılır — yalnız marked_at "girildi" demektir
    const girilen = ((hw.homework_submissions as { marked_at: string | null }[] | null) ?? []).filter(s => s.marked_at).length
    const toplam = mevcut.get(hw.class_id) ?? 0
    return kategorizeOdev({ dueDate: hw.due_date, isaretliSayisi: girilen, ogrenciSayisi: toplam }, now) === 'kontrolBekliyor'
      ? [{ ...hw, girilen, toplam }]
      : []
  })

  if (bekleyen.length === 0) return null

  return (
    <section aria-labelledby="kontrol-bekliyor" className="mb-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-2xl overflow-hidden">
      <header className="px-4 py-3 border-b border-amber-200 dark:border-amber-800/60">
        <h2 id="kontrol-bekliyor" className="text-sm font-semibold text-amber-900 dark:text-amber-200">
          Kontrol bekliyor · {bekleyen.length} ödev
        </h2>
        <p className="text-xs text-amber-800/80 dark:text-amber-300/70 mt-0.5">
          Son tarihi geçti, öğrencilerin işaretlenmesi tamamlanmadı.
        </p>
      </header>
      <ul className="divide-y divide-amber-100 dark:divide-amber-900/40">
        {bekleyen.slice(0, 5).map(hw => {
          const cls = (Array.isArray(hw.classes) ? hw.classes[0] : hw.classes) as { name: string } | null
          // İki taraf da İstanbul günü (YYYY-MM-DD, UTC gece yarısı olarak parse) → tam gün farkı
          const gunOnce = Math.round((Date.parse(today) - Date.parse(hw.due_date ?? '')) / 86_400_000)
          return (
            <li key={hw.id}>
              <Link
                href={`/odevler/${hw.id}`}
                className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-amber-100/50 dark:hover:bg-amber-900/20 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">{hw.title}</p>
                  <p className="text-xs text-gray-600 dark:text-slate-400 mt-0.5 flex flex-wrap gap-x-1.5">
                    <span className="whitespace-nowrap">{cls?.name ?? '—'}</span>
                    {hw.due_date && <span className="whitespace-nowrap">· {format(parseISO(hw.due_date), 'd MMM')}</span>}
                    {hw.toplam > 0 && <span className="whitespace-nowrap tabular-nums">· {hw.girilen}/{hw.toplam} girildi</span>}
                  </p>
                </div>
                <span className="shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                  {gunOnce}g önce
                </span>
              </Link>
            </li>
          )
        })}
        {bekleyen.length > 5 && (
          <li>
            <Link
              href="/odevler"
              className="block px-4 py-2.5 text-center text-xs font-medium text-amber-800 dark:text-amber-300 hover:bg-amber-100/50 dark:hover:bg-amber-900/20 transition-colors"
            >
              +{bekleyen.length - 5} ödev daha → Tümünü gör
            </Link>
          </li>
        )}
      </ul>
    </section>
  )
}
