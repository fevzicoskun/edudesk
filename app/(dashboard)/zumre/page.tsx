import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile } from '@/lib/auth'
import Link from 'next/link'

export const revalidate = 60
import TutanakForm from './TutanakForm'
import TYMMImportForm from './TYMMImportForm'
import MufredatBoard from './MufredatBoard'
import SinavListesi from './SinavListesi'
import {
  createMeeting,
  createExam,
  createCurriculumProgress,
  deleteMeeting,
} from '@/app/actions/zumre'
import { format, parseISO } from 'date-fns'
import { tr } from 'date-fns/locale'

type Tab = 'toplanti' | 'sinav' | 'mufredat'

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

  const profile = await getCurrentProfile()
  const isBaskan = profile?.role === 'zumre_baskani'

  const [meetingsResult, examsResult, curriculumResult, classesResult] = await Promise.all([
    supabase.from('zumre_meetings').select('id, title, meeting_date, notes').order('meeting_date', { ascending: false }),
    supabase.from('common_exams').select('id, title, subject, exam_date, grades, grade_map').order('exam_date', { ascending: false }),
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

  const tabs: { key: Tab; label: string }[] = [
    { key: 'toplanti', label: 'Toplantılar' },
    { key: 'sinav', label: 'Ortak Sınavlar' },
    { key: 'mufredat', label: 'Müfredat' },
  ]

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-5">
        <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">Zümre</h1>
        {isBaskan && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 font-semibold">
            Yönetici
          </span>
        )}
      </div>

      <div className="flex overflow-x-auto border-b border-gray-200 dark:border-slate-700 mb-6">
        {tabs.map(({ key, label }) => (
          <Link
            key={key}
            href={`/zumre?tab=${key}`}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap shrink-0 ${
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
          {isBaskan ? (
            <TutanakForm action={createMeeting} inputCls={inputCls} />
          ) : (
            <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-xl px-4 py-3">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                Toplantı oluşturma ve düzenleme yetkisi Zümre Başkanı&apos;na aittir.
              </p>
            </div>
          )}

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
                    {isBaskan && (
                      <Link
                        href={`/zumre/toplanti/${m.id}/duzenle`}
                        className="text-xs font-medium text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
                      >
                        Düzenle
                      </Link>
                    )}
                    <Link
                      href={`/tutanak/${m.id}`}
                      className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                      </svg>
                      Yazdır
                    </Link>
                    {isBaskan && (
                      <form action={deleteMeeting.bind(null, m.id)}>
                        <button type="submit" className="text-xs text-red-500 hover:text-red-700 font-medium">Sil</button>
                      </form>
                    )}
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
          {isBaskan ? (
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
          ) : (
            <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-xl px-4 py-3">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                Ortak sınav oluşturma yetkisi Zümre Başkanı&apos;na aittir.
              </p>
            </div>
          )}

          <SinavListesi exams={exams} isBaskan={isBaskan} />
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

          <MufredatBoard curriculum={curriculum} classes={classes} />
        </div>
      )}
    </div>
  )
}
