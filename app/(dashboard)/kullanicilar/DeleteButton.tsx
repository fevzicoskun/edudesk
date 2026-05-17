'use client'

import { useState, useTransition } from 'react'
import { removeUser } from '@/app/actions/invite-user'

export default function DeleteButton({ userId, userName }: { userId: string; userName: string }) {
  const [confirm, setConfirm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleDelete = () => {
    startTransition(async () => {
      const res = await removeUser(userId)
      if (res.error) {
        setError(res.error)
        setConfirm(false)
      }
    })
  }

  if (error) {
    return <span className="text-xs text-red-500">{error}</span>
  }

  if (confirm) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-gray-500 dark:text-slate-400 hidden sm:inline">Emin misin?</span>
        <button
          onClick={handleDelete}
          disabled={isPending}
          className="text-xs px-2 py-1 bg-red-500 text-white rounded-md hover:bg-red-600 disabled:opacity-50 transition-colors"
        >
          {isPending ? '...' : 'Evet, Sil'}
        </button>
        <button
          onClick={() => setConfirm(false)}
          className="text-xs px-2 py-1 border border-gray-300 dark:border-slate-600 rounded-md text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
        >
          İptal
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => setConfirm(true)}
      className="text-gray-300 dark:text-slate-600 hover:text-red-400 transition-colors"
      title={`${userName} sil`}
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
    </button>
  )
}
