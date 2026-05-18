'use client'

import { useState, useTransition, useActionState } from 'react'
import { createMeeting, deleteMeeting, updateMeetingNotes } from '@/src/domains/school/actions/meetings'
import { format, parseISO } from '@/lib/date-utils'

const TYPE_LABELS: Record<string, string> = {
  genel: 'Genel',
  veli: 'Veli',
  ogretmenler_kurulu: 'Öğretmenler Kurulu',
  diger: 'Diğer',
}

const TYPE_COLORS: Record<string, string> = {
  genel: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  veli: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  ogretmenler_kurulu: 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300',
  diger: 'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-400',
}

export type Meeting = {
  id: string
  title: string
  meeting_date: string
  meeting_type: string
  attendees: string | null
  notes: string | null
}

export default function SchoolMeetings({ initial }: { initial: Meeting[] }) {
  const [meetings, setMeetings] = useState(initial)
  const [showAdd, setShowAdd] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editingNotes, setEditingNotes] = useState<string | null>(null)
  const [notesDraft, setNotesDraft] = useState('')
  const [isPendingDel, startDelTransition] = useTransition()
  const [isPendingNotes, startNotesTransition] = useTransition()

  const today = new Date().toISOString().split('T')[0]

  const [addState, addAction, addPending] = useActionState(
    async (_: unknown, fd: FormData) => {
      const res = await createMeeting(_, fd)
      if (res.success) {
        setShowAdd(false)
        // Optimistically add to list (will refresh from server on next nav)
        const title = String(fd.get('title') ?? '')
        const meeting_date = String(fd.get('meeting_date') ?? '')
        const meeting_type = String(fd.get('meeting_type') ?? 'genel')
        const notes = String(fd.get('notes') ?? '') || null
        const attendees = String(fd.get('attendees') ?? '') || null
        setMeetings(prev => [
          { id: res.id!, title, meeting_date, meeting_type, notes, attendees },
          ...prev,
        ])
      }
      return res
    },
    null
  )

  const handleDelete = (id: string) => {
    startDelTransition(async () => {
      const res = await deleteMeeting(id)
      if (!res.error) setMeetings(prev => prev.filter(m => m.id !== id))
    })
  }

  const handleSaveNotes = (id: string) => {
    startNotesTransition(async () => {
      const res = await updateMeetingNotes(id, notesDraft)
      if (!res.error) {
        setMeetings(prev => prev.map(m => m.id === id ? { ...m, notes: notesDraft } : m))
        setEditingNotes(null)
      }
    })
  }

  return (
    <section className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300">Yönetim Toplantıları</h2>
        <button
          onClick={() => setShowAdd(v => !v)}
          className="text-xs text-blue-600 dark:text-blue-400 font-medium hover:underline"
        >
          {showAdd ? 'Kapat' : '+ Yeni'}
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <form action={addAction} className="mb-4 space-y-2 p-3 bg-gray-50 dark:bg-slate-700/50 rounded-xl border border-gray-200 dark:border-slate-600">
          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2">
              <input
                name="title"
                required
                minLength={2}
                maxLength={200}
                placeholder="Toplantı adı"
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <input
                name="meeting_date"
                type="date"
                required
                defaultValue={today}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <select
                name="meeting_type"
                defaultValue="genel"
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="genel">Genel</option>
                <option value="veli">Veli</option>
                <option value="ogretmenler_kurulu">Öğretmenler Kurulu</option>
                <option value="diger">Diğer</option>
              </select>
            </div>
            <div className="col-span-2">
              <input
                name="attendees"
                placeholder="Katılımcılar (isteğe bağlı)"
                maxLength={500}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="col-span-2">
              <textarea
                name="notes"
                placeholder="Notlar (isteğe bağlı)"
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
          </div>
          {addState?.error && <p className="text-xs text-red-500">{addState.error}</p>}
          <button
            type="submit"
            disabled={addPending}
            className="w-full py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {addPending ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </form>
      )}

      {/* Meeting list */}
      {meetings.length === 0 ? (
        <p className="text-center text-gray-400 dark:text-slate-500 text-sm py-6">Henüz toplantı kaydı yok.</p>
      ) : (
        <ul className="space-y-2">
          {meetings.map(m => (
            <li key={m.id} className="border border-gray-100 dark:border-slate-700 rounded-lg overflow-hidden">
              <div
                className="flex items-start justify-between gap-2 px-3 py-2.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
                onClick={() => setExpandedId(prev => prev === m.id ? null : m.id)}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-slate-100 leading-snug">{m.title}</p>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    <span className="text-[11px] text-gray-400">
                      {format(parseISO(m.meeting_date), 'd MMM yyyy')}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${TYPE_COLORS[m.meeting_type] ?? TYPE_COLORS.diger}`}>
                      {TYPE_LABELS[m.meeting_type] ?? m.meeting_type}
                    </span>
                    {m.notes && (
                      <span className="text-[10px] text-gray-400 dark:text-slate-500">Not var</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={e => { e.stopPropagation(); handleDelete(m.id) }}
                  disabled={isPendingDel}
                  className="shrink-0 text-gray-300 dark:text-slate-600 hover:text-red-400 transition-colors mt-0.5"
                  title="Sil"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>

              {/* Expanded: notes + attendees */}
              {expandedId === m.id && (
                <div className="px-3 pb-3 pt-0 border-t border-gray-100 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-700/20">
                  {m.attendees && (
                    <p className="text-xs text-gray-500 dark:text-slate-400 mt-2">
                      <span className="font-medium">Katılımcılar:</span> {m.attendees}
                    </p>
                  )}

                  {editingNotes === m.id ? (
                    <div className="mt-2 space-y-2">
                      <textarea
                        value={notesDraft}
                        onChange={e => setNotesDraft(e.target.value)}
                        rows={3}
                        placeholder="Toplantı notları..."
                        className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSaveNotes(m.id)}
                          disabled={isPendingNotes}
                          className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                        >
                          {isPendingNotes ? '...' : 'Kaydet'}
                        </button>
                        <button
                          onClick={() => setEditingNotes(null)}
                          className="px-3 py-1.5 border border-gray-300 dark:border-slate-600 text-xs text-gray-600 dark:text-slate-400 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                        >
                          İptal
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2">
                      {m.notes ? (
                        <p className="text-sm text-gray-700 dark:text-slate-300 whitespace-pre-wrap">{m.notes}</p>
                      ) : (
                        <p className="text-xs text-gray-400 dark:text-slate-500 italic">Not eklenmemiş.</p>
                      )}
                      <button
                        onClick={() => { setEditingNotes(m.id); setNotesDraft(m.notes ?? '') }}
                        className="mt-1.5 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        {m.notes ? 'Notu düzenle' : 'Not ekle'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
