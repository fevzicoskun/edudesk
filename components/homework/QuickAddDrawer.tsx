'use client'

import { useState, useEffect, useTransition } from 'react'
import { usePathname } from 'next/navigation'
import { useToast } from '@/components/Toast'
import { quickCreateHomework, getHomeworkTemplates } from '@/app/actions/homework'
import { getMyClasses } from '@/app/actions/classes'
import type { HomeworkTemplate } from '@/src/shared/types'

type ClassItem = { id: string; name: string; grade: number | null }

const RECENT_KEY = 'hw_recent_class_ids'

function getRecentIds(): string[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') } catch { return [] }
}

function saveRecentIds(ids: string[]) {
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(ids.slice(0, 3))) } catch {}
}

const INPUT = 'w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-gray-900 dark:text-slate-100 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/10 transition-all'

export default function QuickAddDrawer() {
  const [open, setOpen]                       = useState(false)
  const [classes, setClasses]                 = useState<ClassItem[]>([])
  const [selectedIds, setSelectedIds]         = useState<string[]>([])
  const [templates, setTemplates]             = useState<HomeworkTemplate[]>([])
  const [title, setTitle]                     = useState('')
  const [subject, setSubject]                 = useState('')
  const [description, setDescription]         = useState('')
  const [dueDate, setDueDate]                 = useState('')
  const [notifyParents, setNotifyParents]     = useState(true)
  const [error, setError]                     = useState<string | null>(null)
  const [isPending, startTransition]          = useTransition()
  const { toast }                             = useToast()
  const pathname                              = usePathname()

  // Yoklama ekranında ödev FAB'ı hem alakasız hem de satır aksiyon butonlarını kapatıyor → gizle
  const hidden = pathname?.startsWith('/yoklama') ?? false

  useEffect(() => {
    if (!open || classes.length > 0) return
    getMyClasses().then(setClasses)
  }, [open, classes.length])

  useEffect(() => {
    if (selectedIds.length !== 1) { setTemplates([]); return }
    getHomeworkTemplates(selectedIds[0]).then(setTemplates)
  }, [selectedIds])

  const recentIds = getRecentIds()
  const sortedClasses = [
    ...classes.filter(c => recentIds.includes(c.id)),
    ...classes.filter(c => !recentIds.includes(c.id)),
  ]

  function applyTemplate(t: HomeworkTemplate) {
    setTitle(t.title)
    setSubject(t.subject)
    setDescription(t.description ?? '')
  }

  function reset() {
    setSelectedIds([])
    setTitle('')
    setSubject('')
    setDescription('')
    setDueDate('')
    setError(null)
    setTemplates([])
  }

  function close() { setOpen(false); reset() }

  function submit() {
    if (selectedIds.length === 0) { setError('En az bir sınıf seçin'); return }
    if (!title.trim())            { setError('Başlık gerekli'); return }
    if (!subject.trim())          { setError('Ders adı gerekli'); return }
    if (!dueDate)                 { setError('Son teslim tarihi gerekli'); return }
    setError(null)

    startTransition(async () => {
      const fd = new FormData()
      selectedIds.forEach(id => fd.append('class_id', id))
      fd.set('title', title.trim())
      fd.set('subject', subject.trim())
      fd.set('description', description.trim())
      fd.set('due_date', dueDate)
      fd.set('notify_parents', notifyParents ? 'true' : 'false')

      const result = await quickCreateHomework(fd)
      if (result.error) { setError(result.error); return }

      saveRecentIds([...new Set([selectedIds[0], ...recentIds])])
      toast(`${result.ids!.length > 1 ? result.ids!.length + ' sınıfa ' : ''}Ödev oluşturuldu`, 'success')
      close()
    })
  }

  const today = new Date().toISOString().split('T')[0]

  if (hidden) return null

  return (
    <>
      {/* FAB */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Hızlı ödev ekle"
        className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-40 w-14 h-14 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-full shadow-lg shadow-blue-500/30 flex items-center justify-center transition-all"
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40"
          onClick={close}
          aria-hidden="true"
        />
      )}

      {/* Drawer */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Hızlı ödev ekle"
        className={`fixed bottom-0 right-0 z-50 w-full md:w-[420px] h-[92dvh] md:h-full bg-white dark:bg-slate-900 shadow-2xl flex flex-col rounded-t-2xl md:rounded-none transition-transform duration-300 ease-in-out ${
          open ? 'translate-y-0 md:translate-x-0' : 'translate-y-full md:translate-x-full'
        }`}
      >
        {/* Başlık */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100 dark:border-slate-800 shrink-0">
          <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100">Hızlı Ödev Ekle</h2>
          <button
            onClick={close}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-400 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-800 rounded-xl px-3 py-2.5">
              {error}
            </p>
          )}

          {/* Sınıf */}
          <div>
            <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-2">
              Sınıf {selectedIds.length > 1 && <span className="font-normal normal-case text-blue-600">({selectedIds.length} seçili)</span>}
            </p>
            <div className="flex flex-wrap gap-2">
              {sortedClasses.length === 0 && (
                <p className="text-sm text-gray-400 dark:text-slate-500">Yükleniyor...</p>
              )}
              {sortedClasses.map(c => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() =>
                    setSelectedIds(prev =>
                      prev.includes(c.id) ? prev.filter(id => id !== c.id) : [...prev, c.id]
                    )
                  }
                  className={`px-3 py-1.5 rounded-xl border text-sm font-medium transition-colors ${
                    selectedIds.includes(c.id)
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 border-gray-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-600'
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>

          {/* Şablonlar */}
          {templates.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                Şablondan doldur
              </p>
              <div className="flex flex-col gap-1.5">
                {templates.map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => applyTemplate(t)}
                    className="text-left px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 hover:border-blue-300 dark:hover:border-blue-600 transition-colors"
                  >
                    <p className="text-sm font-medium text-gray-800 dark:text-slate-200">{t.title}</p>
                    <p className="text-xs text-gray-400 dark:text-slate-500">{t.subject}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Başlık */}
          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Başlık</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Örn: Sayfa 45–47 soruları"
              className={`mt-1.5 ${INPUT}`}
            />
          </div>

          {/* Ders */}
          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Ders</label>
            <input
              type="text"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="Örn: Matematik"
              className={`mt-1.5 ${INPUT}`}
            />
          </div>

          {/* Açıklama */}
          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
              Açıklama{' '}
              <span className="font-normal text-gray-400 dark:text-slate-500 normal-case tracking-normal">(opsiyonel)</span>
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              className={`mt-1.5 ${INPUT} resize-none`}
            />
          </div>

          {/* Tarih */}
          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Son teslim tarihi</label>
            <input
              type="date"
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
              min={today}
              className={`mt-1.5 ${INPUT}`}
            />
          </div>

          {/* Veli bildirimi */}
          <label className="flex items-center gap-3 cursor-pointer py-1">
            <input
              type="checkbox"
              checked={notifyParents}
              onChange={e => setNotifyParents(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-600 dark:text-slate-400">Oluşturulunca velilere e-posta gönder</span>
          </label>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-100 dark:border-slate-800 shrink-0">
          <button
            type="button"
            onClick={submit}
            disabled={isPending}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-3 text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isPending ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Kaydediliyor...
              </>
            ) : (
              'Ödevi Oluştur'
            )}
          </button>
        </div>
      </div>
    </>
  )
}
