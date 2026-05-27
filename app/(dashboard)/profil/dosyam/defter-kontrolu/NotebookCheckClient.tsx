'use client'

import { useActionState } from 'react'
import { createNotebookCheckAction, deleteNotebookCheckAction } from '@/app/actions/inspection'
import type { NotebookCheck } from '@/src/domains/inspection/types'

interface Props {
  classes: { id: string; name: string; grade: number }[]
  checks:  (NotebookCheck & { classes: { name: string } | null })[]
}

export default function NotebookCheckClient({ classes, checks }: Props) {
  const [state, action, pending] = useActionState(createNotebookCheckAction, null)

  return (
    <div className="flex flex-col gap-4">
      <form action={action} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
        <div className="text-sm font-semibold text-gray-700 mb-3">Yeni Kontrol Kaydı</div>
        {state?.error && (
          <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-1.5 mb-2">
            {state.error}
          </div>
        )}
        <div className="grid grid-cols-3 gap-2 mb-2">
          <div>
            <label className="text-xs font-medium text-gray-600">Sınıf *</label>
            <select name="class_id" required
              className="w-full mt-0.5 border border-gray-300 rounded px-2 py-1 text-sm">
              <option value="">Seç...</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">Tarih *</label>
            <input type="date" name="check_date" required
              defaultValue={new Date().toISOString().split('T')[0]}
              className="w-full mt-0.5 border border-gray-300 rounded px-2 py-1 text-sm" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">Not (opsiyonel)</label>
            <input type="text" name="notes" placeholder="Genel gözlem..."
              className="w-full mt-0.5 border border-gray-300 rounded px-2 py-1 text-sm" />
          </div>
        </div>
        <button type="submit" disabled={pending}
          className="bg-blue-600 text-white text-sm rounded px-3 py-1.5 disabled:opacity-50">
          {pending ? 'Kaydediliyor...' : '+ Kaydet'}
        </button>
      </form>

      {checks.length === 0 ? (
        <p className="text-gray-500 text-sm">Bu dönem kayıt yok.</p>
      ) : (
        <div className="flex flex-col gap-1">
          {checks.map(check => (
            <div key={check.id}
              className="border border-gray-200 rounded-lg px-3 py-2 flex items-center justify-between">
              <div>
                <span className="text-sm font-medium">{check.classes?.name ?? '—'}</span>
                <span className="text-xs text-gray-500 ml-2">{check.check_date}</span>
                {check.notes && (
                  <span className="text-xs text-gray-400 ml-2">· {check.notes}</span>
                )}
              </div>
              <form action={async () => { await deleteNotebookCheckAction(check.id) }}>
                <button type="submit" className="text-xs text-red-400 hover:text-red-600 px-1">
                  Sil
                </button>
              </form>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
