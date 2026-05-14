'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from './Toast'

export function ConfirmDeleteButton({
  action,
  message,
  label = 'Sil',
  successMessage = 'Başarıyla silindi.',
  className = 'text-xs text-red-500 hover:text-red-700 font-medium',
}: {
  action: () => Promise<void>
  message: string
  label?: string
  successMessage?: string
  className?: string
}) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const { toast } = useToast()

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        if (!window.confirm(message)) return
        startTransition(async () => {
          try {
            await action()
            toast(successMessage, 'success')
            router.refresh()
          } catch {
            toast('Silme işlemi başarısız oldu.', 'error')
          }
        })
      }}
      className={`${className} disabled:opacity-50`}
    >
      {isPending ? '...' : label}
    </button>
  )
}
