'use client'

import { useActionState } from 'react'
import { formGonder } from '@/src/shared/utils/formGonder'
import { updateProfile } from '@/src/domains/users/actions'
import { BRANS_LISTESI } from '@/src/shared/constants/branslar'
import AvatarUpload from './AvatarUpload'

const initialState = { error: undefined as string | undefined, success: false }

export default function ProfilForm({
  defaultFullName,
  defaultSubject,
  schoolName,
  email,
  role,
  avatarUrl,
}: {
  defaultFullName: string
  defaultSubject: string
  schoolName: string | null
  email: string
  role: string
  avatarUrl: string | null
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
    // Ayarlar sayfasının en üst bölümü (2026-10-24: /profil → /ayarlar). Çıkış yalnız menünün altında.
    <section aria-labelledby="profil-baslik">
      <h2 id="profil-baslik" className="sr-only">Profil</h2>
      <div className="mb-4 flex items-center gap-4">
        <AvatarUpload name={defaultFullName || email} initialUrl={avatarUrl} />
        <div className="min-w-0">
          <p className="text-lg font-bold text-gray-900 dark:text-slate-100 truncate">
            {defaultFullName || 'Profilim'}
          </p>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
            {defaultSubject ? `${defaultSubject} · ` : ''}Bilgilerini güncelle
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-6">
        <form onSubmit={formGonder(action)} className="space-y-4">
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
            {/* değiştirilemez bilgi: giriş kutusu gibi görünmesin */}
            <p className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Okul</p>
            <p className="text-sm text-gray-900 dark:text-slate-100">{schoolName ?? '—'}</p>
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

    </section>
  )
}
