'use client'

import { useActionState } from 'react'
import { changePassword } from '@/src/domains/auth/actions'

const initial = { error: undefined as string | undefined, success: false }

export default function PasswordForm() {
  const [state, action, pending] = useActionState(
    async (_prev: typeof initial, formData: FormData) => {
      const result = await changePassword(formData)
      return { error: result?.error, success: !result?.error }
    },
    initial
  )

  const inputCls =
    'w-full px-3 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400 dark:placeholder:text-slate-400'

  return (
    <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-6">
      <h2 className="text-sm font-semibold text-gray-900 dark:text-slate-100 mb-4">Şifre Değiştir</h2>
      <form action={action} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
            Yeni Şifre
          </label>
          <input
            name="password"
            type="password"
            required
            minLength={6}
            placeholder="En az 6 karakter"
            className={inputCls}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
            Şifre Tekrar
          </label>
          <input
            name="confirm"
            type="password"
            required
            minLength={6}
            placeholder="Şifreyi tekrar girin"
            className={inputCls}
          />
        </div>

        {state.error && (
          <p className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 px-3 py-2 rounded-lg">
            {state.error}
          </p>
        )}
        {state.success && (
          <p className="text-sm text-green-600 bg-green-50 dark:bg-green-900/20 dark:text-green-400 px-3 py-2 rounded-lg">
            Şifre güncellendi.
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60 transition-colors"
        >
          {pending ? 'Güncelleniyor...' : 'Şifreyi Güncelle'}
        </button>
      </form>
    </div>
  )
}
