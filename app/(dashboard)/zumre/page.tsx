import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import TutanakForm from './TutanakForm'
import TYMMImportForm from './TYMMImportForm'
import { parseTopicString } from '@/lib/tymm-data'
import {
  createMeeting,
  createExam,
  createCurriculumProgress,
  updateCurriculumStatus,
  deleteMeeting,
  deleteExam,
  deleteCurriculumProgress,
} from '@/app/actions/zumre'
import { format, parseISO } from 'date-fns'
import { tr } from 'date-fns/locale'

type Tab = 'toplanti' | 'sinav' | 'mufredat'
type CurriculumStatus = 'tamamlandi' | 'tekrar_gerekli' | 'eksik_kaldi'

const CURRICULUM_LABELS: Record<CurriculumStatus, string> = {
  tamamlandi: 'Tamamlandı',
  tekrar_gerekli: 'Tekrar Gerekli',
  eksik_kaldi: 'Eksik Kaldı',
}

const CURRICULUM_STYLES: Record<CurriculumStatus, string> = {
  tamamlandi: 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/40 dark:text-green-300',
  tekrar_gerekli: 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200 dark:bg-yellow-900/40 dark:text-yellow-300',
  eksik_kaldi: 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/40 dark:text-red-300',
}

const inputCls = 'w-full px-3 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400 dark:placeholder:text-slate-400'

export default async function ZumrePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { tab = 'toplanti' } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [meetingsResult, examsResult, curriculumResult, classesResult] = await Promise.all([
    supabase.from('zumre_meetings').select('*').order('meeting_date', { ascending: false }),
    supabase.from('common_exams').select('*').order('exam_date', { ascending: false }),
    supabase
      .from('curriculum_progress')
      .select('*, classes(grade, name)')
      .eq('teacher_id', user.id)
      .order('week_number', { nullsFirst: true })
      .order('created_at'),
    supabase.from('classes').select('id, name, grade').order('grade').order('name'),
  ])

  const meetings = meetingsResult.data ?? []
  const exams = examsResult.data ?? []
  const curriculum = curriculumResult.data ?? []
  const classes = classesResult.data ?? []
  const grades = [9, 10, 11, 12]

  // Müfredat → sınıf seviyesine göre grupla
  type CurriculumItem = typeof curriculum[number]
  const byGrade = grades.reduce<Record<number, CurriculumItem[]>>((acc, g) => {
    acc[g] = curriculum.filter(c => (c.classes as { grade: number } | null)?.grade === g)
    return acc
  }, {})

  const tabs: { key: Tab; label: string }[] = [
    { key: 'toplanti', label: 'Toplantılar' },
    { key: 'sinav', label: 'Ortak Sınavlar' },
    { key: 'mufredat', label: 'Müfredat' },
  ]

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100 mb-5">Zümre</h1>

      <div className="flex border-b border-gray-200 dark:border-slate-700 mb-6">
        {tabs.map(({ key, label }) => (
          <Link
            key={key}
            href={`/zumre?tab=${key}`}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === key
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 hover:border-gray-300'
            }`}
          >
            {label}
          </Link>
        ))}
      </div>

      {/* ── TOPLANTI ── */}
      {tab === 'toplanti' && (
        <div className="space-y-4">
          <TutanakForm action={createMeeting} inputCls={inputCls} />

          {meetings.length === 0 ? (
            <p className="text-center py-12 text-gray-400 dark:text-slate-500 text-sm">Henüz toplantı eklenmemiş.</p>
          ) : (
            meetings.map((m) => (
              <div key={m.id} className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-900 dark:text-slate-100">{m.title}</p>
                    <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
                      {format(parseISO(m.meeting_date), 'd MMMM yyyy', { locale: tr })}
                    </p>
                    {m.notes && (
                      <p className="text-sm text-gray-600 dark:text-slate-300 mt-2 whitespace-pre-wrap line-clamp-3">{m.notes}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <Link
                      href={`/zumre/toplanti/${m.id}/duzenle`}
                      className="text-xs font-medium text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
                    >
                      Düzenle
                    </Link>
                    <Link
                      href={`/tutanak/${m.id}`}
                      className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                      </svg>
                      Yazdır
                    </Link>
                    <form action={deleteMeeting.bind(null, m.id)}>
                      <button type="submit" className="text-xs text-red-500 hover:text-red-700 font-medium">Sil</button>
                    </form>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── SINAV ── */}
      {tab === 'sinav' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3">Yeni Ortak Sınav</h2>
            <form action={createExam} className="space-y-3">
              <input name="title" type="text" required placeholder="Sınav başlığı" className={inputCls} />
              <input name="subject" type="text" required placeholder="Ders" className={inputCls} />
              <input name="exam_date" type="date" required className={inputCls} />
              <button type="submit" className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
                Ekle
              </button>
            </form>
          </div>

          {exams.length === 0 ? (
            <p className="text-center py-12 text-gray-400 dark:text-slate-500 text-sm">Henüz sınav eklenmemiş.</p>
          ) : (
            exams.map((e) => (
              <div key={e.id} className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 dark:text-slate-100">{e.title}</p>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                    {e.subject} · {format(parseISO(e.exam_date), 'd MMMM yyyy', { locale: tr })}
                  </p>
                </div>
                <form action={deleteExam.bind(null, e.id)}>
                  <button type="submit" className="text-xs text-red-500 hover:text-red-700 font-medium shrink-0">Sil</button>
                </form>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── MÜFREDAT ── */}
      {tab === 'mufredat' && (
        <div className="space-y-4">
          <TYMMImportForm classes={classes} />

          <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3">Manuel Konu Ekle</h2>
            <form action={createCurriculumProgress} className="space-y-3">
              <select name="class_id" required className={inputCls}>
                <option value="">Sınıf seçin</option>
                {classes.length === 0 && <option disabled>Henüz sınıf eklenmemiş</option>}
                {grades.map((g) => {
                  const gradeClasses = classes.filter(c => c.grade === g)
                  if (gradeClasses.length === 0) return null
                  return (
                    <optgroup key={g} label={`${g}. Sınıf`}>
                      {gradeClasses.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </optgroup>
                  )
                })}
              </select>
              <div className="flex gap-2">
                <input name="week_number" type="number" placeholder="Hafta" min="1" max="40"
                  className="w-24 px-3 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <input name="topic" type="text" required placeholder="İşlenen konu" className={inputCls} />
              </div>
              <select name="status" defaultValue="tamamlandi" className={inputCls}>
                <option value="tamamlandi">Tamamlandı</option>
                <option value="tekrar_gerekli">Tekrar gerekli</option>
                <option value="eksik_kaldi">Eksik kaldı</option>
              </select>
              <button type="submit" className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
                Ekle
              </button>
            </form>
          </div>

          {curriculum.length === 0 ? (
            <p className="text-center py-12 text-gray-400 dark:text-slate-500 text-sm">Henüz konu eklenmemiş.</p>
          ) : (
            grades.map((g) => {
              const items = byGrade[g]
              if (items.length === 0) return null
              const done = items.filter(c => c.status === 'tamamlandi').length
              const pct = Math.round((done / items.length) * 100)
              return (
                <div key={g} className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
                  {/* Başlık */}
                  <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-gray-800 dark:text-slate-200">{g}. Sınıf</h3>
                    <div className="flex items-center gap-3">
                      <div className="hidden sm:flex items-center gap-2">
                        <div className="w-24 h-1.5 bg-gray-200 dark:bg-slate-600 rounded-full overflow-hidden">
                          <div className="h-full bg-green-500 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-gray-500 dark:text-slate-400">{done}/{items.length}</span>
                      </div>
                      <span className="text-xs font-medium text-green-600 dark:text-green-400">{pct}%</span>
                    </div>
                  </div>
                  {/* Konular */}
                  <div className="divide-y divide-gray-100 dark:divide-slate-700">
                    {items.map((c) => {
                      const status = (c.status ?? (c.completed ? 'tamamlandi' : 'eksik_kaldi')) as CurriculumStatus
                      return (
                        <div key={c.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2">
                          <div className="flex-1 min-w-0">
                            {(() => {
                              const { code, topic } = parseTopicString(c.topic)
                              return (
                                <>
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    {code && (
                                      <span className="font-mono text-[10px] font-semibold px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 rounded shrink-0">
                                        {code}
                                      </span>
                                    )}
                                    <p className="text-sm text-gray-900 dark:text-slate-100">{topic}</p>
                                  </div>
                                  {c.week_number && (
                                    <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5 ml-0.5">Hafta {c.week_number}</p>
                                  )}
                                </>
                              )
                            })()}
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {(['tamamlandi', 'tekrar_gerekli', 'eksik_kaldi'] as CurriculumStatus[]).map((s) => (
                              <form key={s} action={updateCurriculumStatus.bind(null, c.id, s)}>
                                <button type="submit"
                                  className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${
                                    status === s ? CURRICULUM_STYLES[s] : 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-600'
                                  }`}
                                >
                                  {CURRICULUM_LABELS[s]}
                                </button>
                              </form>
                            ))}
                          </div>
                          <form action={deleteCurriculumProgress.bind(null, c.id)}>
                            <button type="submit" className="text-xs text-red-500 hover:text-red-700 font-medium shrink-0">Sil</button>
                          </form>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
