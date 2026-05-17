'use client'

import { useActionState } from 'react'
import { setupSchool } from '@/app/actions/school'

export default function OnboardingForm({
  existingName,
  fullName,
}: {
  existingName: string
  fullName: string
}) {
  const [state, formAction, isPending] = useActionState(setupSchool, null)

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-950 px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">EduDesk</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Hoş geldiniz, {fullName}</p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-700 p-8">
          {/* Adımlar */}
          <div className="flex items-center gap-2 mb-6">
            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold">1</div>
            <span className="text-xs text-blue-600 font-semibold">Okul Kurulumu</span>
            <div className="flex-1 h-px bg-gray-200 dark:bg-slate-700" />
            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-gray-200 dark:bg-slate-700 text-gray-400 text-xs font-bold">2</div>
            <span className="text-xs text-gray-400">Ekip Daveti</span>
          </div>

          <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100 mb-1">Okulunuzu Kurun</h2>
          <p className="text-sm text-gray-500 dark:text-slate-400 mb-6">
            Okul adını girin. Devam ettiğinizde öğretmenlerinizin katılmak için kullanabileceği bir kod otomatik oluşturulur.
          </p>

          {state?.error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
              {state.error}
            </div>
          )}

          <form action={formAction} className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                Okul Adı
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                defaultValue={existingName}
                placeholder="ör. Bahçeşehir Anadolu Lisesi"
                className="w-full px-3 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 placeholder:text-gray-400 dark:placeholder:text-slate-500"
              />
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isPending ? 'Kuruluyor...' : 'Okulu Kur ve Devam Et →'}
            </button>
          </form>

          <p className="text-xs text-gray-400 dark:text-slate-500 text-center mt-4">
            Kurulumdan sonra öğretmen davet kodu dashboard'unuzda görünür.
          </p>
        </div>
      </div>
    </div>
  )
}
