import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import {
  createMeeting,
  createExam,
  createCurriculumProgress,
  toggleCurriculumDone,
  deleteMeeting,
  deleteExam,
  deleteCurriculumProgress,
} from '@/app/actions/zumre'
import { format, parseISO } from 'date-fns'
import { tr } from 'date-fns/locale'

type Tab = 'toplanti' | 'sinav' | 'mufredat'

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
      .select('*, classes(name)')
      .eq('teacher_id', user.id)
      .order('week_number', { nullsFirst: true })
      .order('created_at'),
    supabase.from('classes').select('id, name').order('grade').order('name'),
  ])

  const meetings = meetingsResult.data ?? []
  const exams = examsResult.data ?? []
  const curriculum = curriculumResult.data ?? []
  const classes = classesResult.data ?? []

  const tabs: { key: Tab; label: string }[] = [
    { key: 'toplanti', label: 'Toplantılar' },
    { key: 'sinav', label: 'Ortak Sınavlar' },
    { key: 'mufredat', label: 'Müfredat' },
  ]

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <h1 className="text-xl font-bold text-gray-900 mb-5">Zümre</h1>

      <div className="flex border-b border-gray-200 mb-6">
        {tabs.map(({ key, label }) => (
          <Link
            key={key}
            href={`/zumre?tab=${key}`}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {label}
          </Link>
        ))}
      </div>

      {tab === 'toplanti' && (
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Yeni Toplantı</h2>
            <form action={createMeeting} className="space-y-3">
              <input
                name="title"
                type="text"
                required
                placeholder="Toplantı başlığı"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                name="meeting_date"
                type="date"
                required
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <textarea
                name="notes"
                rows={3}
                placeholder="Toplantı notları..."
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
              <button
                type="submit"
                className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                Ekle
              </button>
            </form>
          </div>

          {meetings.length === 0 ? (
            <p className="text-center py-12 text-gray-400 text-sm">Henüz toplantı eklenmemiş.</p>
          ) : (
            meetings.map((m) => (
              <div key={m.id} className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-900">{m.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {format(parseISO(m.meeting_date), 'd MMMM yyyy', { locale: tr })}
                    </p>
                    {m.notes && (
                      <p className="text-sm text-gray-600 mt-2 whitespace-pre-wrap">{m.notes}</p>
                    )}
                  </div>
                  <form action={deleteMeeting.bind(null, m.id)}>
                    <button type="submit" className="text-xs text-red-500 hover:text-red-700 font-medium shrink-0">
                      Sil
                    </button>
                  </form>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'sinav' && (
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Yeni Ortak Sınav</h2>
            <form action={createExam} className="space-y-3">
              <input
                name="title"
                type="text"
                required
                placeholder="Sınav başlığı"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                name="subject"
                type="text"
                required
                placeholder="Ders"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                name="exam_date"
                type="date"
                required
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="submit"
                className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                Ekle
              </button>
            </form>
          </div>

          {exams.length === 0 ? (
            <p className="text-center py-12 text-gray-400 text-sm">Henüz sınav eklenmemiş.</p>
          ) : (
            exams.map((e) => (
              <div key={e.id} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-gray-900">{e.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {e.subject} · {format(parseISO(e.exam_date), 'd MMMM yyyy', { locale: tr })}
                  </p>
                </div>
                <form action={deleteExam.bind(null, e.id)}>
                  <button type="submit" className="text-xs text-red-500 hover:text-red-700 font-medium shrink-0">
                    Sil
                  </button>
                </form>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'mufredat' && (
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Konu Ekle</h2>
            <form action={createCurriculumProgress} className="space-y-3">
              <select
                name="class_id"
                required
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Sınıf seçin</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <div className="flex gap-2">
                <input
                  name="week_number"
                  type="number"
                  placeholder="Hafta"
                  min="1"
                  max="40"
                  className="w-24 px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  name="topic"
                  type="text"
                  required
                  placeholder="İşlenen konu"
                  className="flex-1 px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                Ekle
              </button>
            </form>
          </div>

          {curriculum.length === 0 ? (
            <p className="text-center py-12 text-gray-400 text-sm">Henüz konu eklenmemiş.</p>
          ) : (
            curriculum.map((c) => {
              const cls = c.classes as { name: string } | null
              return (
                <div
                  key={c.id}
                  className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{c.topic}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {cls?.name}
                      {c.week_number ? ` · Hafta ${c.week_number}` : ''}
                    </p>
                  </div>
                  <form action={toggleCurriculumDone.bind(null, c.id, !c.completed)}>
                    <button
                      type="submit"
                      className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors shrink-0 ${
                        c.completed
                          ? 'bg-green-100 text-green-700 hover:bg-green-200'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {c.completed ? 'Tamamlandı' : 'Devam Ediyor'}
                    </button>
                  </form>
                  <form action={deleteCurriculumProgress.bind(null, c.id)}>
                    <button type="submit" className="text-xs text-red-500 hover:text-red-700 font-medium shrink-0">
                      Sil
                    </button>
                  </form>
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
