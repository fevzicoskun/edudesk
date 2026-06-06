'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { deleteHomework } from '@/app/actions/homework'

export default function DeleteTemplateButton({ id, title }: { id: string; title: string }) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleDelete() {
    if (!confirm(`"${title}" şablonunu silmek istiyor musunuz?`)) return
    startTransition(async () => {
      await deleteHomework(id)
      router.refresh()
    })
  }

  return (
    <button
      onClick={handleDelete}
      disabled={isPending}
      aria-label="Şablonu sil"
      className="p-1.5 text-gray-300 hover:text-red-500 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 rounded transition-colors"
    >
      {isPending ? (
        <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      ) : (
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      )}
    </button>
  )
}
