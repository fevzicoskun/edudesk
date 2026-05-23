import Link from 'next/link'
import { createClient } from '@/src/infrastructure/supabase/server'
import { getCurrentUser } from '@/src/shared/auth'
import { subDays } from '@/src/shared/date'

type RiskLevel = 'high' | 'medium' | 'low'

interface RiskAlert {
  studentId: string
  studentName: string
  classId: string
  className: string
  riskLevel: RiskLevel
  reasons: string[]
}

function RiskBadge({ level }: { level: RiskLevel }) {
  const config = {
    high: {
      bg: 'bg-red-100 dark:bg-red-900/30',
      text: 'text-red-700 dark:text-red-400',
      icon: (
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
      ),
      label: 'Yüksek Risk',
    },
    medium: {
      bg: 'bg-amber-100 dark:bg-amber-900/30',
      text: 'text-amber-700 dark:text-amber-400',
      icon: (
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
        </svg>
      ),
      label: 'Orta Risk',
    },
    low: {
      bg: 'bg-blue-100 dark:bg-blue-900/30',
      text: 'text-blue-700 dark:text-blue-400',
      icon: (
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
        </svg>
      ),
      label: 'Dikkat',
    },
  }
  const { bg, text, icon, label } = config[level]
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${bg} ${text}`}>
      {icon}
      {label}
    </span>
  )
}

type StudentRow = {
  id: string
  full_name: string
  class_id: string
  classes: { name: string } | null
}

export default async function RiskUyarilariWidget() {
  const user = await getCurrentUser()
  if (!user) return null

  const supabase = await createClient()

  const { data: hwData } = await supabase
    .from('homeworks')
    .select('id, class_id')
    .eq('teacher_id', user.id)
    .is('deleted_at', null)
    .order('due_date', { ascending: false })

  const homeworks = (hwData ?? []) as { id: string; class_id: string }[]
  const hwIds = homeworks.map(h => h.id)
  const classIds = [...new Set(homeworks.map(h => h.class_id))]

  const twoWeeksAgo = subDays(new Date(), 14).toISOString().split('T')[0]

  const [subsResult, attResult, studentsResult] = await Promise.all([
    hwIds.length > 0
      ? supabase
          .from('homework_submissions')
          .select('homework_id, student_id, status')
          .in('homework_id', hwIds)
      : Promise.resolve({ data: [] as unknown }),
    classIds.length > 0
      ? supabase
          .from('attendance')
          .select('student_id, status')
          .in('class_id', classIds)
          .eq('teacher_id', user.id)
          .gte('date', twoWeeksAgo)
      : Promise.resolve({ data: [] as unknown }),
    classIds.length > 0
      ? supabase
          .from('students')
          .select('id, full_name, class_id, classes(name)')
          .in('class_id', classIds)
          .is('deleted_at', null)
      : Promise.resolve({ data: [] as unknown }),
  ])

  const submissions = ((subsResult.data ?? []) as unknown) as { homework_id: string; student_id: string; status: string }[]
  const attendanceRows = ((attResult.data ?? []) as unknown) as { student_id: string; status: string }[]
  const students = ((studentsResult.data ?? []) as unknown) as StudentRow[]

  // Son 5 ödev per sınıf
  const lastHwByClass = new Map<string, string[]>()
  for (const hw of homeworks) {
    const arr = lastHwByClass.get(hw.class_id) ?? []
    if (arr.length < 5) arr.push(hw.id)
    lastHwByClass.set(hw.class_id, arr)
  }
  const hwToClass = new Map(homeworks.map(h => [h.id, h.class_id]))

  // Ödev miss sayısı per öğrenci
  const hwMissMap = new Map<string, number>()
  for (const sub of submissions) {
    const cid = hwToClass.get(sub.homework_id)
    if (!cid) continue
    if (!lastHwByClass.get(cid)?.includes(sub.homework_id)) continue
    if (sub.status === 'eksik' || sub.status === 'yapilmadi' || sub.status === 'gec') {
      hwMissMap.set(sub.student_id, (hwMissMap.get(sub.student_id) ?? 0) + 1)
    }
  }

  // Devamsızlık sayısı per öğrenci (son 14 gün)
  const absenceMap = new Map<string, number>()
  for (const att of attendanceRows) {
    if (att.status === 'absent') {
      absenceMap.set(att.student_id, (absenceMap.get(att.student_id) ?? 0) + 1)
    }
  }

  // Risk seviyesi hesapla
  const alerts: RiskAlert[] = []
  for (const student of students) {
    const hwMisses = hwMissMap.get(student.id) ?? 0
    const absences = absenceMap.get(student.id) ?? 0
    if (hwMisses === 0 && absences === 0) continue

    const reasons: string[] = []
    if (hwMisses >= 1) reasons.push(`Son 5 ödevde ${hwMisses} eksik`)
    if (absences >= 1) reasons.push(`Son 14 günde ${absences} gün devamsız`)

    const hwRisk = hwMisses >= 3 ? 'high' : hwMisses >= 2 ? 'medium' : 'low'
    const attRisk = absences >= 3 ? 'high' : absences >= 2 ? 'medium' : 'low'
    const riskLevel: RiskLevel =
      hwRisk === 'high' || attRisk === 'high' ? 'high' :
      hwRisk === 'medium' || attRisk === 'medium' ? 'medium' : 'low'

    alerts.push({
      studentId: student.id,
      studentName: student.full_name,
      classId: student.class_id,
      className: student.classes?.name ?? '—',
      riskLevel,
      reasons,
    })
  }

  const order: Record<RiskLevel, number> = { high: 0, medium: 1, low: 2 }
  alerts.sort((a, b) => order[a.riskLevel] - order[b.riskLevel] || a.studentName.localeCompare(b.studentName, 'tr'))

  const displayed = alerts.slice(0, 5)
  const highCount = alerts.filter(a => a.riskLevel === 'high').length

  return (
    <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4">
      <header className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300">Risk Uyarıları</h2>
          {highCount > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 font-semibold">
              {highCount} yüksek risk
            </span>
          )}
        </div>
        {alerts.length > 5 && (
          <span className="text-xs text-gray-400">{alerts.length} öğrenci</span>
        )}
      </header>

      {displayed.length === 0 ? (
        <p className="text-center text-gray-400 text-sm py-6">
          Riskli öğrenci yok. Her şey yolunda!
        </p>
      ) : (
        <ul className="space-y-2">
          {displayed.map(alert => (
            <li key={alert.studentId}>
              <Link
                href={`/siniflar/${alert.classId}/ogrenciler/${alert.studentId}`}
                className="flex items-start gap-2 p-2 rounded-lg border border-gray-100 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">
                      {alert.studentName}
                    </span>
                    <RiskBadge level={alert.riskLevel} />
                  </div>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                    {alert.className} · {alert.reasons.join(' · ')}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
