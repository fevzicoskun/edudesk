'use client'

import { useState, useTransition } from 'react'
import { assignMentor } from '@/app/actions/classes'

interface Teacher {
  id: string
  full_name: string
}

interface MentorFormProps {
  classId: string
  currentMentorId: string | null
  teachers: Teacher[]
}

export default function MentorForm({ classId, currentMentorId, teachers }: MentorFormProps) {
  const [selectedId, setSelectedId] = useState<string>(currentMentorId ?? '')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isPending, startTransition] = useTransition()

  const currentMentor = teachers.find(t => t.id === currentMentorId)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    startTransition(async () => {
      try {
        await assignMentor(classId, selectedId || null)
        setSuccess(true)
        setTimeout(() => setSuccess(false), 3000)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Mentor atanamadı')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-3 flex-wrap">
      <div className="flex-1 min-w-48">
        {currentMentor && (
          <p className="text-xs text-gray-500 dark:text-slate-400 mb-1.5">
            Mevcut: <span className="font-medium text-gray-700 dark:text-slate-300">{currentMentor.full_name}</span>
          </p>
        )}
        <select
          value={selectedId}
          onChange={e => setSelectedId(e.target.value)}
          className="w-full text-sm border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px]"
        >
          <option value="">— Mentor yok —</option>
          {teachers.map(t => (
            <option key={t.id} value={t.id}>{t.full_name}</option>
          ))}
        </select>
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50 min-h-[44px]"
      >
        {isPending ? 'Kaydediliyor…' : 'Kaydet'}
      </button>
      {error && <p className="w-full text-xs text-red-500">{error}</p>}
      {success && <p className="w-full text-xs text-green-600 dark:text-green-400">Mentor başarıyla atandı.</p>}
    </form>
  )
}
