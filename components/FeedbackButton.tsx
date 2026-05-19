'use client'

import { useState, useRef, useTransition } from 'react'
import { sendFeedback } from '@/app/actions/feedback'

type Category = 'oneri' | 'istek' | 'sikayet'

const CATEGORIES: { value: Category; label: string; emoji: string }[] = [
  { value: 'oneri',   label: 'Öneri',    emoji: '💡' },
  { value: 'istek',   label: 'İstek',    emoji: '🙏' },
  { value: 'sikayet', label: 'Şikayet',  emoji: '⚠️' },
]

export default function FeedbackButton() {
  const [open, setOpen]         = useState(false)
  const [category, setCategory] = useState<Category>('oneri')
  const [status, setStatus]     = useState<'idle' | 'ok' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [isPending, startTransition] = useTransition()
  const formRef = useRef<HTMLFormElement>(null)

  function handleOpen() { setOpen(true); setStatus('idle') }
  function handleClose() { setOpen(false); setStatus('idle'); setCategory('oneri'); formRef.current?.reset() }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const res = await sendFeedback(fd)
      if (res.ok) {
        setStatus('ok')
        setTimeout(handleClose, 2000)
      } else {
        setStatus('error')
        setErrorMsg(res.error ?? 'Bir hata oluştu.')
      }
    })
  }

  return (
    <>
      <button
        onClick={handleOpen}
        className="w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-500 dark:text-slate-500 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-700 dark:hover:text-slate-300 transition-colors"
      >
        <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
        Geliştiriciye Yaz
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" onClick={handleClose} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md border border-gray-200 dark:border-slate-700">
              <div className="px-5 pt-5 pb-4 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-slate-100">Geliştiriciye Yaz</h2>
                <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              {status === 'ok' ? (
                <div className="px-5 py-10 text-center">
                  <p className="text-2xl mb-2">✅</p>
                  <p className="text-sm font-medium text-gray-700 dark:text-slate-300">Mesajın iletildi, teşekkürler!</p>
                </div>
              ) : (
                <form ref={formRef} onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
                  {/* Kategori */}
                  <div className="flex gap-2">
                    {CATEGORIES.map(c => (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() => setCategory(c.value)}
                        className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-colors ${
                          category === c.value
                            ? 'bg-blue-50 dark:bg-blue-950 border-blue-400 dark:border-blue-600 text-blue-700 dark:text-blue-300'
                            : 'border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-400 hover:border-gray-300 dark:hover:border-slate-600'
                        }`}
                      >
                        {c.emoji} {c.label}
                      </button>
                    ))}
                  </div>
                  <input type="hidden" name="category" value={category} />

                  {/* Mesaj */}
                  <textarea
                    name="message"
                    required
                    minLength={5}
                    maxLength={2000}
                    rows={5}
                    placeholder="Mesajınızı buraya yazın…"
                    className="w-full text-sm border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2.5 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />

                  {status === 'error' && (
                    <p className="text-xs text-red-600 dark:text-red-400">{errorMsg}</p>
                  )}

                  <button
                    type="submit"
                    disabled={isPending}
                    className="w-full py-2.5 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white transition-colors"
                  >
                    {isPending ? 'Gönderiliyor…' : 'Gönder'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </>
      )}
    </>
  )
}
