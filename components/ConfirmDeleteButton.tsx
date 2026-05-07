'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'

export function ConfirmDeleteButton({
  action,
  message,
  label = 'Sil',
  className = 'text-xs text-red-500 hover:text-red-700 font-medium',
}: {
  action: () => Promise<void>
  message: string
  label?: string
  className?: string
}) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        if (!window.confirm(message)) return
        startTransition(async () => {
          await action()
          router.refresh()
        })
      }}
      className={`${className} disabled:opacity-50`}
    >
      {isPending ? '...' : label}
    </button>
  )
}
