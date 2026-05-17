'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import { createMeeting, deleteMeeting, updateMeetingNotes } from '@/app/actions/school-meetings'
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  getDay, isSameDay, isToday, addMonths, subMonths, parseISO,
} from '@/lib/date-utils'

type Meeting = {
  id: string
  title: string
  meeting_date: string
  meeting_type: string
  attendees: string | null
  notes: string | null
}

const TYPE_LABELS: Record<string, string> = {
  genel: 'Genel',
  veli: 'Veli',
  ogretmenler_kurulu: 'Öğretmenler Kurulu',
  diger: 'Diğer',
  not: 'Not',
}

const TYPE_DOT: Record<string, string> = {
  genel:              'bg-purple-500',
  veli:               'bg-emerald-500',
  ogretmenler_kurulu: 'bg-blue-500',
  diger:              'bg-gray-400',
  not:                'bg-amber-400',
}

const TYPE_BADGE: Record<string, string> = {
  genel:              'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300',
  veli:               'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  ogretmenler_kurulu: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  diger:              'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-300',
  not:                'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
}

export default function AjandaWidget({ initial }: { initial: Meeting[] }) {
  const [meetings, setMeetings] = useState<Meeting[]>(initial)
  const [month, setMonth] = useState(() => new Date())
  const [selected, setSelected] = useState<Date | null>(() => new Date())
  const [showForm, setShowForm] = useState(false)
  const [formType, setFormType] = useState<'toplanti' | 'not'>('toplanti')
  const [, startTransition] = useTransition()

  // editing note inline
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editNotes, setEditNotes] = useState('')

  const formRef = useRef<HTMLFormElement>(null)

  const monthStart = startOfMonth(month)
  const monthEnd = endOfMonth(month)
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd })
  const startPad = (getDay(monthStart) + 6) % 7 // Mon=0

  const meetingsOnDay = (d: Date) =>
    meetings.filter(m => isSameDay(parseISO(m.meeting_date), d))

  const selectedMeetings = selected ? meetingsOnDay(selected) : []

  const handleAdd = (fd: FormData) => {
    if (!selected) return
    fd.set('meeting_date', format(selected, 'yyyy-MM-dd'))
    if (formType === 'not') {
      fd.set('meeting_type', 'not')
      if (!fd.get('title') || String(fd.get('title')).trim().length < 2) return
    }
    startTransition(async () => {
      const res = await createMeeting(null, fd)
      if (res.success && res.id) {
        const newM: Meeting = {
          id: res.id,
          title: String(fd.get('title')),
          meeting_date: format(selected, 'yyyy-MM-dd'),
          meeting_type: String(fd.get('meeting_type') ?? 'not'),
          attendees: String(fd.get('attendees') || '') || null,
          notes: String(fd.get('notes') || '') || null,
        }
        setMeetings(prev => [...prev, newM])
        formRef.current?.reset()
        setShowForm(false)
      }
    })
  }

  const handleDelete = (id: string) => {
    startTransition(async () => {
      const res = await deleteMeeting(id)
      if (res.success) setMeetings(prev => prev.filter(m => m.id !== id))
    })
  }

  const handleSaveNote = (id: string) => {
    startTransition(async () => {
      const res = await updateMeetingNotes(id, editNotes)
      if (res.success) {
        setMeetings(prev => prev.map(m => m.id === id ? { ...m, notes: editNotes } : m))
        setEditingId(null)
      }
    })
  }

  return (
    <section className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300">Ajanda</h2>
        <span className="text-xs text-gray-400">{meetings.length} kayıt</span>
      </div>

      <div className="flex flex-col lg:flex-row">
        {/* Takvim */}
        <div className="lg:w-72 p-4 border-b lg:border-b-0 lg:border-r border-gray-100 dark:border-slate-700 shrink-0">
          {/* Ay navigasyon */}
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={() => setMonth(m => subMonths(m, 1))}
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
            >
              <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="text-sm font-semibold text-gray-800 dark:text-slate-200 capitalize">
              {format(month, 'MMMM yyyy')}
            </span>
            <button
              onClick={() => setMonth(m => addMonths(m, 1))}
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
            >
              <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Gün başlıkları */}
          <div className="grid grid-cols-7 mb-1">
            {['Pt','Sa','Ça','Pe','Cu','Ct','Pz'].map(d => (
              <div key={d} className="text-center text-[10px] font-semibold text-gray-400 py-1">{d}</div>
            ))}
          </div>

          {/* Günler */}
          <div className="grid grid-cols-7 gap-y-0.5">
            {Array(startPad).fill(null).map((_, i) => <div key={`pad-${i}`} />)}
            {days.map(day => {
              const dayMeetings = meetingsOnDay(day)
              const isSelected = selected ? isSameDay(day, selected) : false
              const todayDay = isToday(day)
              return (
                <button
                  key={day.toISOString()}
                  onClick={() => { setSelected(day); setShowForm(false) }}
                  className={`relative flex flex-col items-center py-1 rounded-lg transition-colors text-xs font-medium
                    ${isSelected ? 'bg-blue-600 text-white' : todayDay ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-300' : 'text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700'}
                  `}
                >
                  <span>{format(day, 'd')}</span>
                  {dayMeetings.length > 0 && (
                    <div className="flex gap-0.5 mt-0.5 flex-wrap justify-center">
                      {dayMeetings.slice(0, 3).map(m => (
                        <span key={m.id} className={`w-1 h-1 rounded-full ${isSelected ? 'bg-white/80' : TYPE_DOT[m.meeting_type] ?? 'bg-gray-400'}`} />
                      ))}
                    </div>
                  )}
                </button>
              )
            })}
          </div>

          {/* Renk açıklaması */}
          <div className="mt-3 pt-3 border-t border-gray-100 dark:border-slate-700 flex flex-wrap gap-x-3 gap-y-1">
            {Object.entries(TYPE_LABELS).map(([k, v]) => (
              <span key={k} className="flex items-center gap-1 text-[10px] text-gray-500 dark:text-slate-400">
                <span className={`w-1.5 h-1.5 rounded-full ${TYPE_DOT[k]}`} />
                {v}
              </span>
            ))}
          </div>
        </div>

        {/* Sağ panel — seçili gün */}
        <div className="flex-1 min-w-0 p-4">
          {selected && (
            <>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-800 dark:text-slate-200 capitalize">
                  {format(selected, 'd MMMM yyyy, EEEE')}
                </h3>
                <button
                  onClick={() => setShowForm(s => !s)}
                  className="flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  Ekle
                </button>
              </div>

              {/* Ekleme formu */}
              {showForm && (
                <div className="mb-4 p-3 rounded-lg bg-gray-50 dark:bg-slate-700/50 border border-gray-200 dark:border-slate-600">
                  <div className="flex gap-2 mb-3">
                    <button
                      onClick={() => setFormType('toplanti')}
                      className={`text-xs px-3 py-1 rounded-full font-medium transition-colors ${formType === 'toplanti' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600'}`}
                    >
                      Toplantı
                    </button>
                    <button
                      onClick={() => setFormType('not')}
                      className={`text-xs px-3 py-1 rounded-full font-medium transition-colors ${formType === 'not' ? 'bg-amber-500 text-white' : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600'}`}
                    >
                      Not
                    </button>
                  </div>

                  <form ref={formRef} action={handleAdd} className="space-y-2">
                    <input
                      name="title"
                      required
                      minLength={2}
                      placeholder={formType === 'not' ? 'Notunuzu yazın…' : 'Toplantı başlığı'}
                      className="w-full px-3 py-1.5 text-xs border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {formType === 'toplanti' && (
                      <>
                        <select
                          name="meeting_type"
                          defaultValue="genel"
                          className="w-full px-3 py-1.5 text-xs border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="genel">Genel</option>
                          <option value="veli">Veli Toplantısı</option>
                          <option value="ogretmenler_kurulu">Öğretmenler Kurulu</option>
                          <option value="diger">Diğer</option>
                        </select>
                        <input
                          name="attendees"
                          placeholder="Katılımcılar (opsiyonel)"
                          className="w-full px-3 py-1.5 text-xs border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <textarea
                          name="notes"
                          rows={2}
                          placeholder="Notlar (opsiyonel)"
                          className="w-full px-3 py-1.5 text-xs border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                        />
                      </>
                    )}
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        className="flex-1 bg-blue-600 text-white text-xs font-medium py-1.5 rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        Kaydet
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowForm(false)}
                        className="px-3 text-xs text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200"
                      >
                        İptal
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Seçili günün kayıtları */}
              {selectedMeetings.length === 0 ? (
                <p className="text-xs text-gray-400 dark:text-slate-500 text-center py-6">
                  Bu gün için kayıt yok.
                </p>
              ) : (
                <ul className="space-y-2">
                  {selectedMeetings.map(m => (
                    <li key={m.id} className="group rounded-lg border border-gray-100 dark:border-slate-700 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${TYPE_BADGE[m.meeting_type] ?? TYPE_BADGE.diger}`}>
                              {TYPE_LABELS[m.meeting_type] ?? m.meeting_type}
                            </span>
                            <p className="text-xs font-medium text-gray-900 dark:text-slate-100">{m.title}</p>
                          </div>
                          {m.attendees && (
                            <p className="text-[11px] text-gray-400 mt-1">{m.attendees}</p>
                          )}
                          {/* Not alanı */}
                          {editingId === m.id ? (
                            <div className="mt-2 space-y-1.5">
                              <textarea
                                value={editNotes}
                                onChange={e => setEditNotes(e.target.value)}
                                rows={3}
                                className="w-full px-2 py-1.5 text-xs border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                              />
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleSaveNote(m.id)}
                                  className="text-xs bg-blue-600 text-white px-3 py-1 rounded-lg hover:bg-blue-700"
                                >
                                  Kaydet
                                </button>
                                <button
                                  onClick={() => setEditingId(null)}
                                  className="text-xs text-gray-400 hover:text-gray-600 px-1"
                                >
                                  İptal
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => { setEditingId(m.id); setEditNotes(m.notes ?? '') }}
                              className="mt-1.5 text-[11px] text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 text-left"
                            >
                              {m.notes ? m.notes : '+ not ekle'}
                            </button>
                          )}
                        </div>
                        <button
                          onClick={() => handleDelete(m.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-red-50 dark:hover:bg-red-950/30 text-red-400 hover:text-red-600 shrink-0"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  )
}
