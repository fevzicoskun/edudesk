import { createClient } from '@/lib/supabase/server'
import { requireSchoolId } from '@/lib/auth'
import Link from 'next/link'
import { format, parseISO, subDays } from 'date-fns'
import { tr } from 'date-fns/locale'
import { ROLE_LABELS, type Role } from '@/lib/types'
import OkulAyarlari from './OkulAyarlari'

const ROLE_BADGE: Record<Role, string> = {
  mudur:            'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300',
  mudur_yardimcisi: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300',
  zumre_baskani:    'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  ogretmen:         'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-300',
}

function StatCard({ value, label, sub, color }: { value: number | string; label: string; sub?: string; color: string }) {
  return (
    <div className={`rounded-xl border p-4 ${color}`}>
      <p className="text-3xl font-bold">{value}</p>
      <p className="text-sm font-medium mt-0.5">{label}</p>
      {sub && <p className="text-xs opacity-70 mt-0.5">{sub}</p>}
    </div>
  )
}

export default async function MudurDashboard({ fullName }: { fullName: string }) {
  const supabase = await createClient()

  const school_id = await requireSchoolId()

  const twoWeeksAgo = subDays(new Date(), 14).toISOString()

  const [
    schoolRes,
    profilesRes,
    studentsRes,
    classesRes,
    meetingsRes,
    examsRes,
    sessionsRes,
    curriculumRes,
    attendanceRes,
    homeworkRes,
    submissionsRes,
  ] = await Promise.all([
    supabase.from('schools').select('name, slug').eq('id', school_id).single(),
    supabase.from('profiles').select('id, full_name, role, subject'),
    supabase.from('students').select('id', { count: 'exact', head: true }),
    supabase.from('classes').select('id, name, grade', { count: 'exact' }).order('grade').order('name'),
    supabase.from('zumre_meetings').select('id, title, meeting_date, branch').order('meeting_date', { ascending: false }).limit(5),
    supabase.from('common_exams').select('id, title, subject, exam_date').order('exam_date', { ascending: false }).limit(5),
    supabase.from('user_sessions').select('user_id, login_at, last_seen_at, duration_minutes'),
    supabase.from('curriculum_progress').select('class_id, status'),
    supabase.from('attendance').select('date, status', { count: 'exact' }).gte('date', format(subDays(new Date(), 30), 'yyyy-MM-dd')),
    supabase.from('homework').select('id', { count: 'exact', head: true }),
    supabase.from('homework_submissions').select('status'),
  ])

  const schoolName = schoolRes.data?.name ?? ''
  const schoolCode = schoolRes.data?.slug ?? ''
  const profiles = profilesRes.data ?? []
  const studentCount = studentsRes.count ?? 0
  const classes = classesRes.data ?? []
  const meetings = meetingsRes.data ?? []
  const exams = examsRes.data ?? []
  const sessions = sessionsRes.data ?? []
  const curriculum = curriculumRes.data ?? []
  const attendanceRows = attendanceRes.data ?? []
  const homeworkCount = homeworkRes.count ?? 0
  const submissions = submissionsRes.data ?? []

  const teacherProfiles = profiles.filter(p => p.role === 'ogretmen' || p.role === 'zumre_baskani' || p.role === 'mudur_yardimcisi')

  // Öğretmen bazlı session özeti
  type SessionSummary = { count: number; totalMinutes: number; lastSeen: string | null }
  const sessionMap = new Map<string, SessionSummary>()
  for (const s of sessions) {
    const prev = sessionMap.get(s.user_id) ?? { count: 0, totalMinutes: 0, lastSeen: null }
    prev.count += 1
    const mins = s.duration_minutes ?? Math.max(
      Math.round((new Date(s.last_seen_at).getTime() - new Date(s.login_at).getTime()) / 60000), 1
    )
    prev.totalMinutes += mins
    if (!prev.lastSeen || s.last_seen_at > prev.lastSeen) prev.lastSeen = s.last_seen_at
    sessionMap.set(s.user_id, prev)
  }

  // 14 gün içinde hiç giriş yapmayan öğretmenler
  const inactiveTeachers = teacherProfiles.filter(t => {
    const lastSeen = sessionMap.get(t.id)?.lastSeen
    return !lastSeen || lastSeen < twoWeeksAgo
  })

  // Müfredat tamamlanma oranı (sınıf bazında)
  type ClassStat = { done: number; total: number }
  const currMap = new Map<string, ClassStat>()
  for (const c of curriculum) {
    const prev = currMap.get(c.class_id) ?? { done: 0, total: 0 }
    prev.total += 1
    if (c.status === 'tamamlandi') prev.done += 1
    currMap.set(c.class_id, prev)
  }
  const totalCurr = curriculum.length
  const doneCurr = curriculum.filter(c => c.status === 'tamamlandi').length
  const overallCurrPercent = totalCurr > 0 ? Math.round((doneCurr / totalCurr) * 100) : null

  // Son 30 gün devam istatistiği
  const totalAttendance = attendanceRows.length
  const presentCount = attendanceRows.filter(a => a.status === 'present' || a.status === 'var').length
  const attendanceRate = totalAttendance > 0 ? Math.round((presentCount / totalAttendance) * 100) : null

  // Ödev tamamlanma oranı
  const doneSubmissions = submissions.filter(s => s.status === 'yapildi').length
  const totalSubmissions = submissions.length
  const homeworkRate = totalSubmissions > 0 ? Math.round((doneSubmissions / totalSubmissions) * 100) : null

  // Öğretmenleri son aktiviteye göre sırala
  const sortedTeachers = [...teacherProfiles].sort((a, b) => {
    const aLast = sessionMap.get(a.id)?.lastSeen ?? ''
    const bLast = sessionMap.get(b.id)?.lastSeen ?? ''
    return bLast.localeCompare(aLast)
  })

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      {/* Başlık */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">Okul Yönetim Paneli</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
          Merhaba {fullName} · okul geneli özet aşağıda.
        </p>
      </div>

      {/* Özet kartlar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          value={teacherProfiles.length}
          label="Öğretmen"
          sub={`${profiles.filter(p => p.role === 'zumre_baskani').length} zümre başkanı`}
          color="border-purple-200 bg-purple-50 text-purple-800 dark:border-purple-900 dark:bg-purple-950/40 dark:text-purple-200"
        />
        <StatCard
          value={studentCount}
          label="Öğrenci"
          sub={`${classes.length} sınıf`}
          color="border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200"
        />
        <StatCard
          value={attendanceRate !== null ? `%${attendanceRate}` : '—'}
          label="Devam Oranı"
          sub="son 30 gün"
          color="border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
        />
        <StatCard
          value={overallCurrPercent !== null ? `%${overallCurrPercent}` : '—'}
          label="Müfredat Tamamlanma"
          sub={totalCurr > 0 ? `${doneCurr}/${totalCurr} konu` : 'veri yok'}
          color="border-indigo-200 bg-indigo-50 text-indigo-800 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-200"
        />
      </div>

      {/* Öğretmen aktivitesi + Son toplantılar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Öğretmen aktivite tablosu — geniş */}
        <section className="lg:col-span-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300">Öğretmen Aktivitesi</h2>
            <Link href="/kullanicilar" className="text-xs text-purple-600 font-medium hover:underline">Tümü →</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-slate-700">
                <tr>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">Ad Soyad</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide hidden sm:table-cell">Branş</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">Kullanım</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide hidden md:table-cell">Son Giriş</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                {sortedTeachers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-400">Henüz öğretmen kaydı yok.</td>
                  </tr>
                ) : sortedTeachers.map(t => {
                  const stats = sessionMap.get(t.id)
                  const inactive = !stats?.lastSeen || stats.lastSeen < twoWeeksAgo
                  return (
                    <tr key={t.id} className={`hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors ${inactive && stats === undefined ? 'opacity-60' : ''}`}>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <p className="font-medium text-gray-900 dark:text-slate-100">{t.full_name}</p>
                          {inactive && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400 font-semibold shrink-0">Pasif</span>
                          )}
                        </div>
                        <span className={`inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded-full mt-0.5 ${ROLE_BADGE[t.role as Role] ?? ROLE_BADGE.ogretmen}`}>
                          {ROLE_LABELS[t.role as Role] ?? t.role}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-gray-500 dark:text-slate-400 text-xs hidden sm:table-cell">{t.subject ?? '—'}</td>
                      <td className="px-4 py-2.5">
                        {stats ? (
                          <div>
                            <p className="text-xs font-semibold text-gray-800 dark:text-slate-200">{stats.count} giriş</p>
                            <p className="text-[11px] text-gray-400">{(stats.totalMinutes / 60).toFixed(1)} saat</p>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">Giriş yok</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 hidden md:table-cell">
                        {stats?.lastSeen ? (
                          <p className="text-xs text-gray-500 dark:text-slate-400">
                            {new Date(stats.lastSeen).toLocaleDateString('tr-TR')}
                          </p>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Son zümre toplantıları */}
        <section className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300">Son Toplantılar</h2>
          </div>
          {meetings.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-8">Henüz toplantı yok.</p>
          ) : (
            <ul className="space-y-2">
              {meetings.map(m => (
                <li key={m.id} className="border border-gray-100 dark:border-slate-700 rounded-lg px-3 py-2.5">
                  <p className="text-sm font-medium text-gray-900 dark:text-slate-100 leading-snug">{m.title}</p>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    <span className="text-[11px] text-gray-400">
                      {format(parseISO(m.meeting_date), 'd MMM yyyy', { locale: tr })}
                    </span>
                    {m.branch && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 font-semibold">
                        {m.branch}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Pasif öğretmen uyarısı */}
      {inactiveTeachers.length > 0 && (
        <section className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                {inactiveTeachers.length} öğretmen 14 gündür giriş yapmadı
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                {inactiveTeachers.slice(0, 3).map(t => t.full_name).join(', ')}
                {inactiveTeachers.length > 3 && ` ve ${inactiveTeachers.length - 3} kişi daha`}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Ödev istatistiği + Okul Ayarları */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Ödev tamamlanma */}
        <section className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3">Ödev Tamamlanma</h2>
          {totalSubmissions === 0 ? (
            <p className="text-center text-gray-400 text-sm py-6">Henüz ödev verisi yok.</p>
          ) : (
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-500 dark:text-slate-400">Tamamlanan</span>
                  <span className="text-xs font-semibold text-gray-700 dark:text-slate-300">%{homeworkRate}</span>
                </div>
                <div className="h-2.5 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${(homeworkRate ?? 0) >= 70 ? 'bg-emerald-500' : (homeworkRate ?? 0) >= 40 ? 'bg-yellow-400' : 'bg-red-400'}`}
                    style={{ width: `${homeworkRate ?? 0}%` }}
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 pt-1">
                <div className="text-center">
                  <p className="text-lg font-bold text-gray-900 dark:text-slate-100">{homeworkCount}</p>
                  <p className="text-[11px] text-gray-400">Toplam Ödev</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-emerald-600">{doneSubmissions}</p>
                  <p className="text-[11px] text-gray-400">Yapıldı</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-red-500">{totalSubmissions - doneSubmissions}</p>
                  <p className="text-[11px] text-gray-400">Yapılmadı</p>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Okul Ayarları — geniş */}
        <div className="lg:col-span-2">
          <OkulAyarlari initialName={schoolName} initialCode={schoolCode} />
        </div>
      </div>

      {/* Ortak sınavlar + Müfredat sınıf durumu */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Ortak sınavlar */}
        <section className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300">Ortak Sınavlar</h2>
          </div>
          {exams.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-8">Henüz ortak sınav yok.</p>
          ) : (
            <ul className="space-y-2">
              {exams.map(e => (
                <li key={e.id} className="flex items-center justify-between gap-3 border border-gray-100 dark:border-slate-700 rounded-lg px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">{e.title}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">{e.subject}</p>
                  </div>
                  <span className="text-[11px] text-gray-500 shrink-0">
                    {format(parseISO(e.exam_date), 'd MMM', { locale: tr })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Müfredat — sınıf bazlı tamamlanma */}
        <section className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300">Müfredat Durumu</h2>
          </div>
          {classes.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-8">Henüz sınıf kaydı yok.</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {classes.map(cls => {
                const stat = currMap.get(cls.id)
                const pct = stat && stat.total > 0 ? Math.round((stat.done / stat.total) * 100) : null
                return (
                  <div key={cls.id} className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-700 dark:text-slate-300 w-16 shrink-0">{cls.name}</span>
                    {pct !== null ? (
                      <>
                        <div className="flex-1 h-2 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-yellow-400' : 'bg-red-400'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs font-semibold text-gray-600 dark:text-slate-400 w-9 text-right">%{pct}</span>
                      </>
                    ) : (
                      <span className="text-xs text-gray-400 ml-2">Veri yok</span>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
