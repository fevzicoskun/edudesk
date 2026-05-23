'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { deleteSchool } from '@/app/actions/admin'

export default function DeleteSchoolButton({
  schoolId,
  schoolName,
}: {
  schoolId: string
  schoolName: string
}) {
  const [confirm, setConfirm] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteSchool(schoolId)
      if (result.error) {
        setError(result.error)
        setConfirm(false)
      } else {
        router.refresh()
      }
    })
  }

  if (error) return <span className="text-xs text-red-500">{error}</span>

  if (confirm) {
    return (
      <span className="flex items-center gap-1">
        <button
          onClick={handleDelete}
          disabled={isPending}
          className="text-xs bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700 disabled:opacity-50"
        >
          {isPending ? 'Siliniyor...' : 'Evet, sil'}
        </button>
        <button
          onClick={() => setConfirm(false)}
          className="text-xs text-gray-500 hover:text-gray-700 px-1"
        >
          İptal
        </button>
      </span>
    )
  }

  return (
    <button
      onClick={() => setConfirm(true)}
      title={`${schoolName} okulunu sil`}
      className="text-xs text-red-500 hover:text-red-700 hover:underline"
    >
      Sil
    </button>
  )
}
