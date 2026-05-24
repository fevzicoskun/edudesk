'use client'

import { useActionState, useRef } from 'react'
import { createAnnouncement } from '@/app/actions/announcements'
import { ROLE_LABELS } from '@/src/shared/types'

const ROLE_LABEL_MAP = ROLE_LABELS as Record<string, string>

export default function DuyuruForm({ allowedRoles }: { allowedRoles: readonly string[] }) {
  const formRef = useRef<HTMLFormElement>(null)
  const [state, action, pending] = useActionState(
    async (_: unknown, fd: FormData) => {
      const res = await createAnnouncement(_, fd)
      if (res?.success) formRef.current?.reset()
      return res
    },
    null
  )

  return (
    <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-5">
      <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-4">Yeni Duyuru</h2>
      <form ref={formRef} action={action} className="space-y-4">

        <div>
          <label className="block text-xs text-gray-500 dark:text-slate-400 mb-2">Hedef Gruplar *</label>
          <div className="flex flex-wrap gap-3">
            {allowedRoles.map(role => (
              <label key={role} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  name="target_roles"
                  value={role}
                  className="w-4 h-4 rounded border-gray-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500 focus:ring-2"
                />
                <span className="text-sm text-gray-700 dark:text-slate-300">
                  {ROLE_LABEL_MAP[role] ?? role}
                </span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1">Duyuru Metni *</label>
          <textarea
            name="message"
            required
            minLength={10}
            rows={5}
            placeholder="Duyurunuzu buraya yazın..."
            className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-base bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        {state?.error && (
          <p className="text-xs text-red-500 dark:text-red-400">{state.error}</p>
        )}

        {state?.success && (
          <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
            Duyuru gönderildi.
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {pending ? 'Gönderiliyor...' : 'Duyuru Gönder'}
        </button>
      </form>
    </div>
  )
}
