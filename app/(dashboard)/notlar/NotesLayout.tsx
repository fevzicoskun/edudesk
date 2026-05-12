'use client'

import { useState, useCallback } from 'react'
import { createNote, deleteNote } from '@/app/actions/notes'
import NotesEditor from './NotesEditor'

export type Note = {
  id: string
  title: string
  content: string
  created_at: string
  updated_at: string
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export default function NotesLayout({ notes: initial }: { notes: Note[] }) {
  const [notes, setNotes] = useState<Note[]>(initial)
  const [selectedId, setSelectedId] = useState<string | null>(initial[0]?.id ?? null)
  const [creating, setCreating] = useState(false)
  const [showEditor, setShowEditor] = useState(false)

  const selectedNote = notes.find(n => n.id === selectedId) ?? null

  const handleCreate = async () => {
    setCreating(true)
    try {
      const id = await createNote()
      const newNote: Note = {
        id,
        title: 'Yeni Not',
        content: '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      setNotes(prev => [newNote, ...prev])
      setSelectedId(id)
      setShowEditor(true)
    } finally {
      setCreating(false)
    }
  }

  const handleSelect = (id: string) => {
    setSelectedId(id)
    setShowEditor(true)
  }

  const handleDelete = async (id: string) => {
    await deleteNote(id)
    setNotes(prev => prev.filter(n => n.id !== id))
    if (selectedId === id) {
      const remaining = notes.filter(n => n.id !== id)
      setSelectedId(remaining[0]?.id ?? null)
      if (remaining.length === 0) setShowEditor(false)
    }
  }

  const handleNoteUpdate = useCallback((updated: Partial<Note> & { id: string }) => {
    setNotes(prev => prev.map(n => n.id === updated.id ? { ...n, ...updated } : n))
  }, [])

  return (
    <div className="flex-1 flex min-h-0 border border-gray-200 dark:border-slate-700 rounded-2xl overflow-hidden bg-white dark:bg-slate-900">
      {/* Sol liste */}
      <div className={`${showEditor ? 'hidden md:flex' : 'flex'} w-full md:w-64 shrink-0 flex-col border-r border-gray-200 dark:border-slate-700`}>
        <div className="p-3 border-b border-gray-100 dark:border-slate-700">
          <button
            onClick={handleCreate}
            disabled={creating}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            {creating ? 'Oluşturuluyor...' : 'Yeni Not'}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {notes.length === 0 ? (
            <p className="text-center text-sm text-gray-400 dark:text-slate-500 py-10 px-4">
              Henüz not yok. Yeni Not ile başlayın.
            </p>
          ) : (
            notes.map(note => (
              <button
                key={note.id}
                onClick={() => handleSelect(note.id)}
                className={`w-full text-left px-4 py-3 border-b border-gray-100 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors group ${
                  note.id === selectedId ? 'bg-blue-50 dark:bg-blue-950 border-l-2 border-l-blue-600' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className={`text-sm font-medium truncate ${note.id === selectedId ? 'text-blue-700 dark:text-blue-300' : 'text-gray-800 dark:text-slate-200'}`}>
                    {note.title || 'Başlıksız Not'}
                  </p>
                  <button
                    onClick={e => { e.stopPropagation(); handleDelete(note.id) }}
                    className="opacity-0 group-hover:opacity-100 shrink-0 text-gray-400 hover:text-red-500 transition-all"
                    title="Notu sil"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
                <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{formatDate(note.updated_at)}</p>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Sağ editör */}
      <div className={`${showEditor ? 'flex' : 'hidden md:flex'} flex-1 flex-col min-w-0`}>
        {selectedNote ? (
          <NotesEditor
            key={selectedNote.id}
            note={selectedNote}
            onUpdate={handleNoteUpdate}
            onBack={() => setShowEditor(false)}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400 dark:text-slate-500">
            <svg className="w-12 h-12 mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-sm">Bir not seçin veya yeni not oluşturun</p>
          </div>
        )}
      </div>
    </div>
  )
}
