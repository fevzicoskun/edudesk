'use client'

import { useActionState } from 'react'
import { sendPasswordReset } from '@/app/actions/auth'

type State = { error?: string; sent?: boolean } | null

export default function ForgotPasswordForm() {
  const [state, formAction, isPending] = useActionState<State, FormData>(sendPasswordReset, null)

  if (state?.sent) {
    return (
      <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 rounded-xl px-5 py-4 text-sm leading-relaxed">
        <p className="font-medium mb-1">Kontrol edin!</p>
        <p>E-posta adresinize şifre sıfırlama bağlantısı gönderildi. Gelen kutunuzu ve spam klasörünüzü kontrol edin.</p>
      </div>
    )
  }

  return (
    <form action={formAction} className="space-y-4">
      {state?.error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 dark:bg-red-950/30 dark:border-red-800 dark:text-red-400">
          {state.error}
        </div>
      )}

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
          E-posta
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="ornek@okul.com"
          className="w-full px-3 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg text-base bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 placeholder:text-gray-400 dark:placeholder:text-slate-500"
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isPending ? 'Gönderiliyor...' : 'Sıfırlama Bağlantısı Gönder'}
      </button>

      <p className="text-center text-xs text-gray-500 dark:text-slate-400 pt-1">
        <a href="/login" className="text-blue-600 hover:underline font-medium">← Girişe dön</a>
      </p>
    </form>
  )
}
