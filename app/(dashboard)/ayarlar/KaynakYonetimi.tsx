'use client'

import { useActionState, useTransition, useOptimistic, useState } from 'react'
import { createHomeworkSource, deleteHomeworkSource } from '@/app/actions/homework-source'

type Source = { id: string; name: string; subject: string | null }
type OptimisticAction = { type: 'add'; source: Source } | { type: 'remove'; id: string }

const inputCls =
  'px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 transition-all'

export default function KaynakYonetimi({ initial }: { initial: Source[] }) {
  const [optimistic, updateOptimistic] = useOptimistic<Source[], OptimisticAction>(
    initial,
    (state, action) => {
      if (action.type === 'add')    return [...state, action.source]
      if (action.type === 'remove') return state.filter(s => s.id !== action.id)
      return state
    },
  )
  const [, startTransition] = useTransition()
  const [state, formAction, isPending] = useActionState(createHomeworkSource, null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  function handleDelete(source: Source) {
    setDeleteError(null)
    startTransition(async () => {
      updateOptimistic({ type: 'remove', id: source.id })
      try {
        await deleteHomeworkSource(source.id)
      } catch (e) {
        console.error('[KaynakYonetimi] deleteHomeworkSource:', e)
        setDeleteError(`"${source.name}" silinemedi. Lütfen tekrar deneyin.`)
      }
    })
  }

  return (
    <section id="kaynaklar" className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-5 space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300">Kaynak / Kitap Listesi</h2>
        <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
          Ödev verirken seçebileceğiniz kaynakları tanımlayın. Hangi kitabı ne zaman kullandığınız takip edilir.
        </p>
      </div>

      {/* Kaynak listesi */}
      <ul className="space-y-1.5">
        {optimistic.map(s => (
          <li key={s.id} className="flex items-center justify-between gap-2 px-3 py-2.5 bg-gray-50 dark:bg-slate-700/50 rounded-xl border border-gray-200 dark:border-slate-600">
            <div className="min-w-0">
              <span className="text-sm font-medium text-gray-800 dark:text-slate-200 truncate block">{s.name}</span>
              {s.subject && (
                <span className="text-xs text-gray-500 dark:text-slate-400">{s.subject}</span>
              )}
            </div>
            <button
              onClick={() => handleDelete(s)}
              className="p-1.5 text-gray-400 hover:text-red-500 dark:text-slate-500 dark:hover:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors shrink-0"
              aria-label="Kaynağı sil"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </li>
        ))}
        {optimistic.length === 0 && (
          <li className="px-3 py-4 text-center text-sm text-gray-500 dark:text-slate-400">
            Henüz kaynak eklenmedi.
          </li>
        )}
      </ul>

      {/* Hata mesajları */}
      {deleteError && (
        <p className="text-xs text-red-600 dark:text-red-400">{deleteError}</p>
      )}

      {/* Yeni kaynak formu */}
      <form
        action={(formData) => {
          const name    = String(formData.get('name') ?? '').trim()
          const subject = String(formData.get('subject') ?? '').trim() || null
          if (!name) return
          updateOptimistic({ type: 'add', source: { id: crypto.randomUUID(), name, subject } })
          formAction(formData)
        }}
        className="space-y-2"
      >
        {state?.error && (
          <p className="text-xs text-red-600 dark:text-red-400">{state.error}</p>
        )}
        <div className="flex gap-2">
          <input
            name="name"
            required
            placeholder="Kaynak adı (örn. Kondisyon Soru Bankası)"
            className={`flex-1 min-w-0 ${inputCls}`}
          />
          <input
            name="subject"
            placeholder="Ders (opsiyonel)"
            className={`w-32 ${inputCls}`}
          />
          <button
            type="submit"
            disabled={isPending}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold disabled:opacity-60 transition-colors shrink-0"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Ekle
          </button>
        </div>
      </form>
    </section>
  )
}
