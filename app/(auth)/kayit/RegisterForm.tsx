'use client'

import { useActionState } from 'react'
import { register } from '@/src/domains/auth/actions'
import Link from 'next/link'

const inputCls = 'w-full px-3 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 placeholder:text-gray-400 dark:placeholder:text-slate-500'

export default function RegisterForm() {
  const [state, formAction, isPending] = useActionState(register, null)

  return (
    <form action={formAction} className="space-y-4">
      {state?.error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {state.error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Ad Soyad</label>
        <input name="full_name" type="text" required autoComplete="name" placeholder="Ahmet Yılmaz" className={inputCls} />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">E-posta</label>
        <input name="email" type="email" required autoComplete="email" placeholder="ornek@okul.com" className={inputCls} />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Şifre</label>
        <input name="password" type="password" required autoComplete="new-password" placeholder="En az 6 karakter" className={inputCls} />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Branş</label>
        <input name="subject" type="text" required placeholder="Matematik, Türkçe…" className={inputCls} />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Okul Kodu</label>
        <input
          name="school_code"
          type="text"
          required
          placeholder="Müdürünüzden alın (örn: ABK729)"
          className={inputCls + ' uppercase tracking-widest'}
          style={{ fontVariantNumeric: 'tabular-nums' }}
        />
        <p className="text-xs text-gray-400 mt-1">Okul kodunu müdürünüzden veya müdür yardımcınızdan alın.</p>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isPending ? 'Kayıt yapılıyor...' : 'Kayıt Ol'}
      </button>

      <p className="text-xs text-gray-400 dark:text-slate-500 text-center pt-1">
        Zaten hesabın var mı?{' '}
        <Link href="/login" className="text-blue-600 hover:underline font-medium">Giriş Yap</Link>
      </p>
    </form>
  )
}
