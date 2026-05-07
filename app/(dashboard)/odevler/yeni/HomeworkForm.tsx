'use client'

import { useActionState } from 'react'
import { createHomework } from '@/app/actions/homework'
import Link from 'next/link'

type ClassItem = { id: string; name: string; grade: number }

export default function HomeworkForm({ classes }: { classes: ClassItem[] }) {
  const [state, formAction, isPending] = useActionState(createHomework, null)

  return (
    <form action={formAction} className="space-y-5">
      {state?.error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {state.error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Sınıf</label>
        <select
          name="class_id"
          required
          className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Sınıf seçin</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Ders</label>
        <input
          name="subject"
          type="text"
          required
          placeholder="Matematik"
          className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Başlık</label>
        <input
          name="title"
          type="text"
          required
          placeholder="Ödev başlığı"
          className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Açıklama{' '}
          <span className="text-gray-400 font-normal">(opsiyonel)</span>
        </label>
        <textarea
          name="description"
          rows={3}
          placeholder="Ödev açıklaması..."
          className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Son Teslim Tarihi</label>
        <input
          name="due_date"
          type="date"
          required
          className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="flex gap-3 pt-2">
        <Link
          href="/odevler"
          className="flex-1 text-center px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          İptal
        </Link>
        <button
          type="submit"
          disabled={isPending}
          className="flex-1 bg-blue-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isPending ? 'Kaydediliyor...' : 'Ödev Ekle'}
        </button>
      </div>
    </form>
  )
}
