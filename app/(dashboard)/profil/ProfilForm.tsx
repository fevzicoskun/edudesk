'use client'

import { useActionState } from 'react'
import { updateProfile } from '@/src/domains/users/actions'
import { logout } from '@/src/domains/auth/actions'
import { BRANS_LISTESI } from '@/src/shared/constants/branslar'

const initialState = { error: undefined as string | undefined, success: false }

export default function ProfilForm({
  defaultFullName,
  defaultSubject,
  schoolName,
  email,
  role,
}: {
  defaultFullName: string
  defaultSubject: string
  schoolName: string | null
  email: string
  role: string
}) {
  const [state, action, pending] = useActionState(
    async (_prev: typeof initialState, formData: FormData) => {
      const result = await updateProfile(formData)
      return { error: result.error, success: !result.error }
    },
    initialState
  )

  const inputCls = 'w-full px-3 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg text-base bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400 dark:placeholder:text-slate-400'

  return (
    <div className="p-4 md:p-6 max-w-lg mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">Profil Ayarları</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">Bilgilerini güncelle</p>
      </div>

      <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-6">
        <form action={action} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
              E-posta
            </label>
            <input
              type="email"
              value={email}
              disabled
              className={inputCls + ' opacity-50 cursor-not-allowed'}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
              Ad Soyad
            </label>
            <input
              name="full_name"
              type="text"
              required
              defaultValue={defaultFullName}
              placeholder="Adınızı girin"
              className={inputCls}
            />
          </div>

          {role !== 'mudur_yardimcisi' && role !== 'mudur' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
                Branş / Ders
              </label>
              <select
                name="subject"
                defaultValue={defaultSubject || ''}
                className={inputCls}
              >
                <option value="">— Seçiniz —</option>
                {BRANS_LISTESI.map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
              Okul Adı
            </label>
            <div className={inputCls + ' bg-gray-50 dark:bg-slate-700/50 opacity-75 cursor-not-allowed'}>
              {schoolName ?? '—'}
            </div>
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

      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-slate-700">
        <form action={logout}>
          <button
            type="submit"
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-red-500 hover:bg-red-50 dark:hover:bg-slate-700 hover:text-red-600 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            Çıkış Yap
          </button>
        </form>
      </div>
    </div>
  )
}
