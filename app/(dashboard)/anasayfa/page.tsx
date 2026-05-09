import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { addDays, format, parseISO } from 'date-fns'
import { tr } from 'date-fns/locale'

export const dynamic = 'force-dynamic'

type ClassRel = { name: string; grade: number } | null
type StudentRel = {
  id: string
  full_name: string
  class_id: string
  classes: ClassRel
} | null

type HwLite = {
  id: string
  title: string
  subject: string
  due_date: string
  class_id: string
  classes: ClassRel
}

type SubLite = {
  homework_id: string
  student_id: string
  status: string
  students: StudentRel
}

type Tone = 'blue' | 'indigo' | 'yellow' | 'red'

export default async function AnasayfaPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single()

  const isZumreBaskani = profile?.role === 'zumre_baskani'

  // ─── Tarih sınırları ────────────────────────────────────────────────
  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]
  const next7Str = addDays(today, 7).toISOString().split('T')[0]

  // ─── Görünür ödevler ────────────────────────────────────────────────
  let hwQuery = supabase
    .from('homeworks')
    .select('id, title, subject, due_date, class_id, classes(name, grade)')
    .order('due_date', { ascending: false })

  if (!isZumreBaskani) hwQuery = hwQuery.eq('teacher_id', user.id)

  const { data: hwData } = await hwQuery
  const homeworks = (hwData ?? []) as unknown as HwLite[]
  const hwIds = homeworks.map((h) => h.id)

  // ─── Submission'ları tek seferde çek ────────────────────────────────
  let allSubs: SubLite[] = []
  if (hwIds.length) {
    const { data: subData } = await supabase
      .from('homework_submissions')
      .select(
        'homework_id, student_id, status, students(id, full_name, class_id, classes(name, grade))',
      )
      .in('homework_id', hwIds)
    allSubs = (subData ?? []) as unknown as SubLite[]
  }

  // ─── Bugün / yaklaşan ───────────────────────────────────────────────
  const todayHws = homeworks.filter((h) => h.due_date === todayStr)
  const upcomingHws = homeworks
    .filter((h) => h.due_date > todayStr && h.due_date <= next7Str)
    .sort((a, b) => a.due_date.localeCompare(b.due_date))

  // ─── Eksik / yapılmadı sayıları ─────────────────────────────────────
  const missingCount = allSubs.filter((s) => s.status === 'eksik').length
  const notDoneCount = allSubs.filter((s) => s.status === 'yapilmadi').length

  // ─── Riskli öğrenciler (son 5 ödevde ≥2 olumsuz) ────────────────────
  const lastHwIds = homeworks.slice(0, 5).map((h) => h.id) // due_date desc sıralı
  const recentSubs = allSubs.filter((s) => lastHwIds.includes(s.homework_id))

  type Bucket = { student: StudentRel; neg: number; total: number }
  const studentBuckets = new Map<string, Bucket>()

  for (const s of recentSubs) {
    if (!s.student_id) continue
    const prev = studentBuckets.get(s.student_id) ?? {
      student: s.students,
      neg: 0,
      total: 0,
    }
    prev.total += 1
    if (s.status === 'eksik' || s.status === 'yapilmadi' || s.status === 'gec') {
      prev.neg += 1
    }
    if (!prev.student) prev.student = s.students
    studentBuckets.set(s.student_id, prev)
  }

  const risky = [...studentBuckets.values()]
    .filter((b) => b.total >= 3 && b.neg >= 2 && b.student)
    .sort((a, b) => b.neg - a.neg)
    .slice(0, 10)

  // ─── Sınıf bazlı özet ───────────────────────────────────────────────
  type ClassEntry = {
    name: string
    grade: number
    hwCount: number
    total: number
    done: number
  }
  const classMap = new Map<string, ClassEntry>()

  for (const hw of homeworks) {
    const cls = hw.classes
    if (!cls) continue
    const entry =
      classMap.get(hw.class_id) ?? {
        name: cls.name,
        grade: cls.grade,
        hwCount: 0,
        total: 0,
        done: 0,
      }
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
    .map(([class_id, v]) => ({
      class_id,
      ...v,
      percent: v.total ? Math.round((v.done / v.total) * 100) : 0,
    }))
    .sort((a, b) => a.grade - b.grade || a.name.localeCompare(b.name, 'tr'))

  // ─── Render ─────────────────────────────────────────────────────────
  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-900">Anasayfa</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Merhaba {profile?.full_name ?? ''} · hızlı bir özet aşağıda.
        </p>
      </div>

      {/* Özet kartları */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <SummaryCard label="Bugünkü ödev" value={todayHws.length} tone="blue" />
        <SummaryCard label="Yaklaşan (7 gün)" value={upcomingHws.length} tone="indigo" />
        <SummaryCard label="Eksik" value={missingCount} tone="yellow" />
        <SummaryCard label="Yapılmadı" value={notDoneCount} tone="red" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {/* Bugün ve yaklaşan ödevler */}
        <section className="bg-white border border-gray-200 rounded-xl p-4">
          <header className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700">Bugün ve Yaklaşan</h2>
            <Link href="/anasayfa">Anasayfa</Link>
            
            <Link
              href="/odevler"
              className="text-xs text-blue-600 font-medium hover:underline"
            >
              Tümü →
            </Link>
          </header>

          {todayHws.length + upcomingHws.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-8">
              Bugün veya önümüzdeki 7 gün için ödev yok.
            </p>
          ) : (
            <ul className="space-y-2">
              {[
                ...todayHws.map((h) => ({ ...h, isToday: true })),
                ...upcomingHws.map((h) => ({ ...h, isToday: false })),
              ].map((hw) => (
                <li key={hw.id}>
                  <Link
                    href={`/odevler/${hw.id}`}
                    className="block rounded-lg border border-gray-200 px-3 py-2 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-gray-900 truncate">
                        {hw.title}
                      </span>
                      {hw.isToday && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 font-semibold">
                          BUGÜN
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {hw.classes?.name ?? '—'} · {hw.subject} ·{' '}
                      {(() => {
                        try {
                          return format(parseISO(hw.due_date), 'd MMM', { locale: tr })
                        } catch {
                          return hw.due_date
                        }
                      })()}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Riskli öğrenciler */}
        <section className="bg-white border border-gray-200 rounded-xl p-4">
          <header className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700">Riskli Öğrenciler</h2>
            <span className="text-[10px] text-gray-400">son 5 ödev · ≥2 olumsuz</span>
          </header>

          {risky.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-8">
              Şu an risk altında öğrenci yok.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {risky.map((r, i) => (
                <li
                  key={r.student?.id ?? i}
                  className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-gray-200"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {r.student?.full_name ?? '—'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {r.student?.classes?.name ?? '—'}
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-red-600 shrink-0">
                    {r.neg}/{r.total}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Sınıf bazlı özet */}
      <section className="bg-white border border-gray-200 rounded-xl p-4">
        <header className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-700">Sınıf Bazlı Özet</h2>
          <Link
            href="/siniflar"
            className="text-xs text-blue-600 font-medium hover:underline"
          >
            Sınıflar →
          </Link>
        </header>

        {classSummary.length === 0 ? (
          <p className="text-center text-gray-400 text-sm py-8">
            Henüz sınıf veya ödev kaydı yok.
          </p>
        ) : (
          <div className="space-y-2">
            {classSummary.map((c) => (
              <div
                key={c.class_id}
                className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-gray-200"
              >
                <div className="min-w-0 flex items-center gap-3 flex-1">
                  <span className="text-sm font-medium text-gray-900 w-16 shrink-0">
                    {c.name}
                  </span>
                  <span className="text-xs text-gray-500 hidden sm:inline shrink-0">
                    {c.hwCount} ödev
                  </span>
                  <div className="flex-1 hidden sm:block">
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500"
                        style={{ width: `${c.percent}%` }}
                      />
                    </div>
                  </div>
                </div>
                <span className="text-sm font-semibold text-gray-700 shrink-0 w-12 text-right">
                  %{c.percent}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: Tone
}) {
  const TONE: Record<Tone, string> = {
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    yellow: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    red: 'bg-red-50 text-red-700 border-red-200',
  }
  return (
    <div className={`border rounded-xl p-3 ${TONE[tone]}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs mt-0.5 opacity-90">{label}</p>
    </div>
  )
}