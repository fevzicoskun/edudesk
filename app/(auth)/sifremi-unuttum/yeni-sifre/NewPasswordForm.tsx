'use client'

import { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { resetPassword } from '@/app/actions/auth'

type State = { error?: string } | null

export default function NewPasswordForm() {
  const router = useRouter()
  const [state, formAction, isPending] = useActionState<State, FormData>(resetPassword, null)

  useEffect(() => {
    if (state !== null && !state?.error) {
      router.push('/anasayfa')
    }
  }, [state, router])

  const inputCls =
    'w-full px-3 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg text-base bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400'

  return (
    <form action={formAction} className="space-y-4">
      {state?.error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 dark:bg-red-950/30 dark:border-red-800 dark:text-red-400">
          {state.error}
        </div>
      )}

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
          Yeni Şifre
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
          placeholder="En az 6 karakter"
          className={inputCls}
        />
      </div>

      <div>
        <label htmlFor="confirm" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
          Şifre Tekrar
        </label>
        <input
          id="confirm"
          name="confirm"
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
          placeholder="Şifreyi tekrar girin"
          className={inputCls}
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isPending ? 'Kaydediliyor...' : 'Şifremi Güncelle'}
      </button>
    </form>
  )
}
