import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/src/shared/auth'
import { isMudurOrAbove, isTeachingRole } from '@/src/shared/types'
import { ActivityReportRepository } from '@/src/domains/dashboard/repositories/ActivityReportRepository'
import {
  buildTeacherStats,
  computeSummary,
  actionLabel,
  roleLabel,
  extractTitle,
  nameInitials,
  since30daysISO,
  type LogRow,
  type TeacherRow,
} from '@/src/domains/dashboard/lib/activityReport'
import { formatDistanceToNow, parseISO } from '@/src/shared/date'

export const revalidate = 0

export const metadata = { title: 'Öğretmen Aktivitesi' }

export default async function OgretmenAktivitePage() {
  const profile = await getCurrentProfile()
  if (!profile?.school_id || !isMudurOrAbove(profile.role)) {
    redirect('/anasayfa')
  }

  const since = since30daysISO()

  const [{ data: teacherData }, { data: logData }] = await Promise.all([
    ActivityReportRepository.getTeachers(profile.school_id),
    ActivityReportRepository.getLogs(profile.school_id, since),
  ])

  // Rapor "Öğretmen Aktivitesi" — yalnız öğretmen rolleri (müdür/MY yönetici,
  // bu listede gereksiz). Anasayfa "Öğretmen Aktivitesi" kartıyla tutarlı.
  const teachers = ((teacherData ?? []) as TeacherRow[]).filter(t => isTeachingRole(t.role))
  const allowedIds = new Set(teachers.map(t => t.id))
  const logs = ((logData ?? []) as LogRow[]).filter(l => allowedIds.has(l.teacher_id))

  const stats   = buildTeacherStats(teachers, logs)
  const summary = computeSummary(teachers, logs)

  const teacherMap = new Map(teachers.map(t => [t.id, t.full_name ?? 'Bilinmiyor']))

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">

      {/* Başlık */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">Öğretmen Aktivitesi</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
          Son 30 gün · {teachers.length} öğretmen
        </p>
      </div>

      {/* Özet kartlar */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-2xl p-4 text-center">
          <p className="text-3xl font-bold text-blue-700 dark:text-blue-400">{summary.activeCount}</p>
          <p className="text-xs text-blue-500 dark:text-blue-400 mt-1">Aktif Öğretmen</p>
        </div>
        <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-2xl p-4 text-center">
          <p className="text-3xl font-bold text-green-700 dark:text-green-400">{summary.totalActivity}</p>
          <p className="text-xs text-green-600 dark:text-green-400 mt-1">Toplam Aktivite</p>
        </div>
        <div className="bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-4 text-center">
          <p className="text-3xl font-bold text-gray-700 dark:text-slate-300">{summary.passiveCount}</p>
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">Pasif</p>
        </div>
      </div>

      {/* Öğretmen özet tablosu */}
      <div>
        <p className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wide mb-2">
          Öğretmen Özeti
        </p>
        {stats.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-8 text-center">
            <p className="text-gray-400 text-sm">Henüz öğretmen kaydı yok.</p>
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-slate-700/50 border-b border-gray-200 dark:border-slate-700">
                <tr>
                  {['Ad Soyad', 'Rol', 'Yoklama', 'Ödev', 'Toplam', 'Son Aktivite'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-slate-400">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50">
                {stats.map(s => (
                  <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-slate-100">{s.fullName}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-slate-400 text-xs">{roleLabel(s.role)}</td>
                    <td className="px-4 py-3 text-gray-700 dark:text-slate-300">{s.yoklamaCount}</td>
                    <td className="px-4 py-3 text-gray-700 dark:text-slate-300">{s.odevCount}</td>
                    <td className="px-4 py-3 font-semibold text-gray-900 dark:text-slate-100">{s.totalCount}</td>
                    <td className="px-4 py-3 text-gray-400 dark:text-slate-500 text-xs">
                      {s.lastActivity
                        ? formatDistanceToNow(parseISO(s.lastActivity), { addSuffix: true })
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Aktivite zaman akışı */}
      <div>
        <p className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wide mb-2">
          Aktivite Akışı
        </p>
        {logs.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-8 text-center">
            <p className="text-gray-400 text-sm">Son 30 günde aktivite kaydı yok.</p>
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl divide-y divide-gray-50 dark:divide-slate-700/50">
            {logs.slice(0, 100).map(log => {
              const name     = teacherMap.get(log.teacher_id) ?? '?'
              const initials = nameInitials(name)
              const title    = extractTitle(log.meta)
              const detail   = title ? ` — ${title}` : ''

              return (
                <div key={log.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-xs font-bold text-blue-700 dark:text-blue-300 shrink-0">
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0 truncate">
                    <span className="font-medium text-gray-900 dark:text-slate-100 text-sm">{name}</span>
                    <span className="text-gray-500 dark:text-slate-400 text-sm">
                      {' · '}{actionLabel(log.action)}{detail}
                    </span>
                  </div>
                  <span className="text-xs text-gray-400 dark:text-slate-500 shrink-0">
                    {formatDistanceToNow(parseISO(log.created_at), { addSuffix: true })}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

    </div>
  )
}
