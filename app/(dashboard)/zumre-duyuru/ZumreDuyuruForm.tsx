'use client'

import { useActionState, useRef } from 'react'
import { sendZumreNotification } from '@/app/actions/zumreDuyuru'

export default function ZumreDuyuruForm() {
  const formRef = useRef<HTMLFormElement>(null)
  const [state, action, pending] = useActionState(
    async (_: unknown, fd: FormData) => {
      const res = await sendZumreNotification(_, fd)
      if (res?.success) formRef.current?.reset()
      return res
    },
    null
  )

  return (
    <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-5">
      <form ref={formRef} action={action} className="space-y-4">
        <div>
          <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1">
            Bildirim Mesajı *
          </label>
          <textarea
            name="message"
            required
            minLength={5}
            rows={5}
            placeholder="Zümre öğretmenlerine iletmek istediğiniz mesajı yazın..."
            className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-base bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        {state?.error && (
          <p className="text-xs text-red-500 dark:text-red-400">{state.error}</p>
        )}

        {state?.success && (
          <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
            {state.count} öğretmene bildirim gönderildi.
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {pending ? 'Gönderiliyor...' : 'Bildirim Gönder'}
        </button>
      </form>
    </div>
  )
}
