'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
import { updateNote } from '@/app/actions/notes'
import type { Note } from './NotesLayout'

const PRESET_COLORS = [
  { label: 'Siyah', value: '#111827' },
  { label: 'Kırmızı', value: '#dc2626' },
  { label: 'Mavi', value: '#2563eb' },
  { label: 'Yeşil', value: '#16a34a' },
  { label: 'Mor', value: '#9333ea' },
  { label: 'Turuncu', value: '#ea580c' },
]

type SaveStatus = 'saved' | 'saving' | 'unsaved'

function ToolBtn({ onAction, title, children }: { onAction: () => void; title: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onMouseDown={e => { e.preventDefault(); onAction() }}
      title={title}
      className="px-2 py-1.5 rounded text-xs font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
    >
      {children}
    </button>
  )
}

export default function NotesEditor({
  note,
  onUpdate,
  onBack,
}: {
  note: Note
  onUpdate: (updated: Partial<Note> & { id: string }) => void
  onBack: () => void
}) {
  const editorRef = useRef<HTMLDivElement>(null)
  const titleRef = useRef<HTMLInputElement>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const titleRef2 = useRef(note.title)
  const contentRef = useRef(note.content)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved')
  const [showColors, setShowColors] = useState(false)

  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = note.content
    }
    titleRef2.current = note.title
    contentRef.current = note.content
  }, [note.id])

  const exec = useCallback((cmd: string, value?: string) => {
    editorRef.current?.focus()
    document.execCommand(cmd, false, value)
  }, [])

  const scheduleSave = useCallback(() => {
    setSaveStatus('unsaved')
    clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(async () => {
      setSaveStatus('saving')
      try {
        await updateNote(note.id, titleRef2.current, contentRef.current)
        setSaveStatus('saved')
        onUpdate({ id: note.id, title: titleRef2.current, content: contentRef.current, updated_at: new Date().toISOString() })
      } catch (err) {
        console.error('updateNote error:', err)
        setSaveStatus('unsaved')
      }
    }, 1200)
  }, [note.id, onUpdate])

  return (
    <div className="flex flex-col h-full">
      {/* Başlık satırı */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 dark:border-slate-700">
        <button
          onClick={onBack}
          className="md:hidden p-1 rounded text-gray-400 hover:text-gray-700"
          title="Geri"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <input
          ref={titleRef}
          defaultValue={note.title}
          placeholder="Not başlığı..."
          onChange={e => {
            titleRef2.current = e.target.value
            scheduleSave()
          }}
          className="flex-1 text-base font-semibold text-gray-900 dark:text-slate-100 bg-transparent outline-none placeholder:text-gray-300 dark:placeholder:text-slate-600"
        />
        <span className="text-xs text-gray-400 dark:text-slate-500 shrink-0">
          {new Date(note.created_at).toLocaleDateString('tr-TR')}
        </span>
      </div>

      {/* Toolbar */}
      <div className="px-3 py-1.5 border-b border-gray-100 dark:border-slate-700 flex items-center gap-0.5 flex-wrap">
        <ToolBtn onAction={() => exec('bold')} title="Kalın (Ctrl+B)">
          <span className="font-bold">B</span>
        </ToolBtn>
        <ToolBtn onAction={() => exec('italic')} title="İtalik (Ctrl+I)">
          <span className="italic">I</span>
        </ToolBtn>
        <ToolBtn onAction={() => exec('underline')} title="Altı Çizili (Ctrl+U)">
          <span className="underline">U</span>
        </ToolBtn>
        <ToolBtn onAction={() => exec('strikeThrough')} title="Üstü Çizili">
          <span className="line-through">S</span>
        </ToolBtn>
        <span className="w-px h-5 bg-gray-200 mx-1.5" />
        <ToolBtn onAction={() => exec('formatBlock', 'h1')} title="Başlık 1">H1</ToolBtn>
        <ToolBtn onAction={() => exec('formatBlock', 'h2')} title="Başlık 2">H2</ToolBtn>
        <ToolBtn onAction={() => exec('formatBlock', 'p')} title="Normal Metin">P</ToolBtn>
        <span className="w-px h-5 bg-gray-200 mx-1.5" />
        <ToolBtn onAction={() => exec('insertUnorderedList')} title="Madde İşaretli Liste">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </ToolBtn>
        <ToolBtn onAction={() => exec('insertOrderedList')} title="Numaralı Liste">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
          </svg>
        </ToolBtn>
        <span className="w-px h-5 bg-gray-200 mx-1.5" />
        <div className="relative">
          <button
            type="button"
            onMouseDown={e => { e.preventDefault(); setShowColors(v => !v) }}
            title="Yazı Rengi"
            className="flex items-center gap-1 px-2 py-1.5 rounded text-xs font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
          >
            <span className="font-bold text-blue-600">A</span>
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {showColors && (
            <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg p-2 z-10 flex gap-1.5">
              {PRESET_COLORS.map(({ label, value }) => (
                <button
                  key={value}
                  type="button"
                  onMouseDown={e => { e.preventDefault(); exec('foreColor', value); setShowColors(false) }}
                  title={label}
                  className="w-5 h-5 rounded-full border-2 border-white shadow-sm hover:scale-110 transition-transform"
                  style={{ backgroundColor: value }}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Editör */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={() => {
          contentRef.current = editorRef.current?.innerHTML ?? ''
          scheduleSave()
        }}
        onClick={() => setShowColors(false)}
        data-placeholder="Notlarınızı buraya yazın..."
        className="notes-editor flex-1 overflow-y-auto p-5 text-sm text-gray-800 dark:text-slate-200 focus:outline-none leading-relaxed"
      />

      {/* Footer */}
      <div className="px-5 py-2 border-t border-gray-100 dark:border-slate-700 flex items-center justify-between">
        <p className="text-xs text-gray-400 hidden sm:block">Ctrl+B kalın · Ctrl+I italik · Ctrl+U altı çizili</p>
        <div className="flex items-center gap-1.5 text-xs ml-auto">
          {saveStatus === 'saved' && (
            <>
              <svg className="w-3.5 h-3.5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-green-600">Kaydedildi</span>
            </>
          )}
          {saveStatus === 'saving' && <span className="text-gray-400">Kaydediliyor...</span>}
          {saveStatus === 'unsaved' && <span className="text-amber-500">Kaydedilmedi</span>}
        </div>
      </div>
    </div>
  )
}
