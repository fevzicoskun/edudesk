'use client'

import { useActionState } from 'react'
import { updateProfile } from '@/app/actions/profile'
import { useEffect, useRef } from 'react'

const initialState = { error: undefined as string | undefined, success: false }

function reducer(_prev: typeof initialState, result: { error?: string }) {
  return { error: result.error, success: !result.error }
}

export default function ProfilPage() {
  const [state, action, pending] = useActionState(
    async (_prev: typeof initialState, formData: FormData) => {
      const result = await updateProfile(formData)
      return reducer(_prev, result)
    },
    initialState
  )

  const ref = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (state.success) {
      const t = setTimeout(() => {}, 3000)
      return () => clearTimeout(t)
    }
  }, [state.success])

  return (
    <div className="p-4 md:p-6 max-w-lg mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">Profil Ayarları</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">Adını ve ders bilgini güncelle</p>
      </div>

      <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-6">
        <form ref={ref} action={action} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
              Ad Soyad
            </label>
            <input
              name="full_name"
              type="text"
              required
              placeholder="Adınızı girin"
              className="w-full px-3 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400 dark:placeholder:text-slate-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
              Branş / Ders
            </label>
            <input
              name="subject"
              type="text"
              placeholder="Örn: Matematik, Türkçe..."
              className="w-full px-3 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400 dark:placeholder:text-slate-400"
            />
          </div>

          {state.error && (
            <p className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 px-3 py-2 rounded-lg">
              {state.error}
            </p>
          )}

          {state.success && (
            <p className="text-sm text-green-600 bg-green-50 dark:bg-green-900/20 dark:text-green-400 px-3 py-2 rounded-lg">
              Profil güncellendi.
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60 transition-colors"
          >
            {pending ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </form>
      </div>
    </div>
  )
}
