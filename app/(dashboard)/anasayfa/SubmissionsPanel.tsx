import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

type ClassRel = { name: string; grade: number } | null
type StudentRel = { id: string; full_name: string; class_id: string; classes: ClassRel } | null

type HwLite = {
  id: string
  class_id: string
  classes: ClassRel
}

type SubLite = {
  homework_id: string
  student_id: string
  status: string
  students: StudentRel
}

type Tone = 'blue' | 'indigo' | 'yellow' | 'rose'
const TONE: Record<Tone, string> = {
  blue:   'bg-blue-50 text-blue-700 border-blue-200',
  indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  yellow: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  rose:   'bg-rose-50 text-rose-700 border-rose-200',
}

function SummaryCard({ label, value, tone }: { label: string; value: number; tone: Tone }) {
  return (
    <div className={`border rounded-xl p-3 ${TONE[tone]}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs mt-0.5 opacity-90">{label}</p>
    </div>
  )
}

export default async function SubmissionsPanel({
  hwIds,
  homeworks,
  todayCount,
  upcomingCount,
}: {
  hwIds: string[]
  homeworks: HwLite[]
  todayCount: number
  upcomingCount: number
}) {
  const supabase = await createClient()

  let allSubs: SubLite[] = []
  if (hwIds.length) {
    const { data } = await supabase
      .from('homework_submissions')
      .select('homework_id, student_id, status, students(id, full_name, class_id, classes(name, grade))')
      .in('homework_id', hwIds)
    allSubs = (data ?? []) as unknown as SubLite[]
  }

  const missingCount = allSubs.filter((s) => s.status === 'eksik').length
  const notDoneCount = allSubs.filter((s) => s.status === 'yapilmadi').length

  // Watchlist: her sınıfın son 5 ödevi baz alınır (homeworks due_date DESC gelir)
  const lastHwIdsByClass = new Map<string, Set<string>>()
  const hwToClassId = new Map(homeworks.map((h) => [h.id, h.class_id]))
  for (const hw of homeworks) {
    const set = lastHwIdsByClass.get(hw.class_id) ?? new Set<string>()
    if (set.size < 5) set.add(hw.id)
    lastHwIdsByClass.set(hw.class_id, set)
  }
  type Bucket = { student: StudentRel; neg: number; total: number }
  const buckets = new Map<string, Bucket>()
  for (const s of allSubs) {
    if (!s.student_id) continue
    const cid = hwToClassId.get(s.homework_id)
    if (!cid || !lastHwIdsByClass.get(cid)?.has(s.homework_id)) continue
    const prev = buckets.get(s.student_id) ?? { student: s.students, neg: 0, total: 0 }
    prev.total += 1
    if (s.status === 'eksik' || s.status === 'yapilmadi' || s.status === 'gec') prev.neg += 1
    if (!prev.student) prev.student = s.students
    buckets.set(s.student_id, prev)
  }
  const watchlist = [...buckets.values()]
    .filter((b) => b.total >= 3 && b.neg >= 2 && b.student)
    .sort((a, b) => b.neg - a.neg)
    .slice(0, 10)

  // Sınıf özeti
  type ClassEntry = { name: string; grade: number; hwCount: number; total: number; done: number }
  const classMap = new Map<string, ClassEntry>()
  for (const hw of homeworks) {
    if (!hw.classes) continue
    const entry = classMap.get(hw.class_id) ?? { name: hw.classes.name, grade: hw.classes.grade, hwCount: 0, total: 0, done: 0 }
    entry.hwCount += 1
    classMap.set(hw.class_id, entry)
  }
  const hwClassIndex = new Map(homeworks.map((h) => [h.id, h.class_id]))
  for (const sub of allSubs) {
    const cid = hwClassIndex.get(sub.homework_id)
    if (!cid) continue
    const entry = classMap.get(cid)
    if (!entry) continue
    entry.total += 1
    if (sub.status === 'yapildi') entry.done += 1
  }
  const classSummary = [...classMap.entries()]
    .map(([class_id, v]) => ({ class_id, ...v, percent: v.total ? Math.round((v.done / v.total) * 100) : 0 }))
    .sort((a, b) => a.grade - b.grade || a.name.localeCompare(b.name, 'tr'))

  return (
    <>
      {/* 4 özet kart — tam satır, hepsi bir arada */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <SummaryCard label="Bugünkü ödev"    value={todayCount}    tone="blue" />
        <SummaryCard label="Yaklaşan (7 gün)" value={upcomingCount} tone="indigo" />
        <SummaryCard label="Eksik"            value={missingCount}  tone="yellow" />
        <SummaryCard label="Yapılmadı"        value={notDoneCount}  tone="rose" />
      </div>

      {/* Takip listesi + sınıf özeti */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <section className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4">
          <header className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300">Ödev Takip Listesi</h2>
            <span className="text-[10px] text-gray-400">son 5 ödev · ≥2 eksik/yapılmadı</span>
          </header>
          {watchlist.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-8">Tüm öğrenciler ödevlerini tamamlıyor.</p>
          ) : (
            <ul className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
              {watchlist.map((r, i) => (
                <li key={r.student?.id ?? i} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-700">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">{r.student?.full_name ?? '—'}</p>
                    <p className="text-xs text-gray-500 dark:text-slate-400">{r.student?.classes?.name ?? '—'}</p>
                  </div>
                  <span className="text-xs font-semibold text-red-600 shrink-0">{r.neg}/{r.total}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4">
          <header className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300">Sınıf Bazlı Özet</h2>
            <Link href="/siniflar" className="text-xs text-blue-600 font-medium hover:underline">Sınıflar →</Link>
          </header>
          {classSummary.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-8">Henüz sınıf veya ödev kaydı yok.</p>
          ) : (
            <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
              {classSummary.map((c) => (
                <div key={c.class_id} className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-700">
                  <div className="min-w-0 flex items-center gap-3 flex-1">
                    <span className="text-sm font-medium text-gray-900 dark:text-slate-100 w-16 shrink-0">{c.name}</span>
                    <span className="text-xs text-gray-500 hidden sm:inline shrink-0">{c.hwCount} ödev</span>
                    <div className="flex-1 hidden sm:block">
                      <div className="h-2 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500" style={{ width: `${c.percent}%` }} />
                      </div>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-gray-700 dark:text-slate-300 shrink-0 w-12 text-right">%{c.percent}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  )
}

function Sk({ className }: { className?: string }) {
  return <div className={`bg-gray-200 dark:bg-slate-700 rounded-lg animate-pulse ${className ?? ''}`} />
}

export function SubmissionsPanelSkeleton() {
  return (
    <>
      {/* 4 kart iskeleti */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="border border-gray-200 dark:border-slate-700 rounded-xl p-3 space-y-2">
            <Sk className="h-8 w-10" />
            <Sk className="h-3 w-20" />
          </div>
        ))}
      </div>
      {/* 2 kolon iskeleti */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4 space-y-3">
            <Sk className="h-4 w-32" />
            {Array.from({ length: 4 }).map((_, j) => (
              <Sk key={j} className="h-10 w-full" />
            ))}
          </div>
        ))}
      </div>
    </>
  )
}
