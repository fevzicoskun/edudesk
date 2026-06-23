'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { applySchool } from './actions'

const inputCls = 'w-full px-3 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg text-base bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 placeholder:text-gray-400 dark:placeholder:text-slate-500'

export default function RegisterForm() {
  const [state, formAction, isPending] = useActionState(applySchool, null)

  if (state?.success) {
    return (
      <div className="text-center space-y-3 py-4">
        <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto">
          <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-base font-semibold text-gray-900 dark:text-slate-100">Başvurunuz alındı!</h3>
        <p className="text-sm text-gray-500 dark:text-slate-400">
          En kısa sürede sizinle iletişime geçeceğiz.
        </p>
        <Link href="/login" className="inline-block text-sm text-blue-600 hover:underline font-medium mt-2">
          Giriş sayfasına dön
        </Link>
      </div>
    )
  }

  return (
    <form action={formAction} className="space-y-4">
      {state?.error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {state.error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
          Okul Adı <span className="text-red-500">*</span>
        </label>
        <input
          name="school_name"
          type="text"
          required
          placeholder="Bahçeşehir Anadolu Lisesi"
          className={inputCls}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
          Yetkili Adı Soyadı <span className="text-red-500">*</span>
        </label>
        <input
          name="contact_name"
          type="text"
          required
          placeholder="Ahmet Yılmaz"
          className={inputCls}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
          E-posta <span className="text-red-500">*</span>
        </label>
        <input
          name="email"
          type="email"
          required
          placeholder="mudur@okul.com"
          className={inputCls}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
          Telefon
        </label>
        <input
          name="phone"
          type="tel"
          placeholder="0532 000 00 00"
          className={inputCls}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
          Notunuz
        </label>
        <textarea
          name="note"
          rows={3}
          placeholder="Kaç öğretmen var, ne tür ihtiyaçlarınız var..."
          className={inputCls + ' resize-none'}
        />
      </div>

      <div className="flex items-start gap-2.5">
        <input
          type="checkbox"
          name="kvkk"
          id="kvkk"
          required
          className="mt-0.5 w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 shrink-0"
        />
        <label htmlFor="kvkk" className="text-xs text-gray-500 dark:text-slate-400 leading-relaxed">
          <Link href="/gizlilik" target="_blank" className="text-blue-600 hover:underline font-medium">
            Aydınlatma metnini
          </Link>{' '}
          ve{' '}
          <Link href="/kullanim-kosullari" target="_blank" className="text-blue-600 hover:underline font-medium">
            kullanım koşullarını
          </Link>{' '}
          okudum, kabul ediyorum.
        </label>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isPending ? 'Gönderiliyor...' : 'Başvuruyu Gönder'}
      </button>

      <p className="text-xs text-gray-500 dark:text-slate-400 text-center pt-1">
        Zaten hesabın var mı?{' '}
        <Link href="/login" className="text-blue-600 hover:underline font-medium">Giriş Yap</Link>
      </p>
    </form>
  )
}
