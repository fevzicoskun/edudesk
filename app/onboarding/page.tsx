'use client'

import { useState, useTransition } from 'react'
import { setupSchool, joinSchool } from '@/app/actions/onboarding'

type Tab = 'join' | 'create'

export default function OnboardingPage() {
  const [tab, setTab] = useState<Tab>('join')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(action: typeof setupSchool | typeof joinSchool) {
    return (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault()
      setError(null)
      const fd = new FormData(e.currentTarget)
      startTransition(async () => {
        const result = await action(fd)
        if (result?.error) setError(result.error)
      })
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-gray-100 p-8">

        {/* Header */}
        <div className="mb-7 text-center">
          <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 3.741-3.342M6.75 15a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm0 0v-3.675A55.378 55.378 0 0 1 12 8.443m-7.007 11.55A5.981 5.981 0 0 0 6.75 15.75v-1.5" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">EduDesk&apos;e Hoş Geldiniz</h1>
          <p className="text-sm text-gray-500 mt-1">Okulunuzu seçin veya yeni okul kurun</p>
        </div>

        {/* Tabs */}
        <div className="flex rounded-xl bg-gray-100 p-1 mb-6">
          <button
            type="button"
            onClick={() => { setTab('join'); setError(null) }}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
              tab === 'join'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Okula Katıl
          </button>
          <button
            type="button"
            onClick={() => { setTab('create'); setError(null) }}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
              tab === 'create'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Yeni Okul Kur
          </button>
        </div>

        {/* Join */}
        {tab === 'join' && (
          <form onSubmit={handleSubmit(joinSchool)} className="space-y-4">
            <div>
              <label htmlFor="code" className="block text-sm font-medium text-gray-700 mb-1">
                Okul Kodu
              </label>
              <input
                id="code"
                name="code"
                type="text"
                required
                placeholder="Zümre başkanınızdan alın"
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <p className="text-xs text-gray-400 mt-1.5">
                Okul kodu Zümre Başkanı&apos;nın profil sayfasında görünür.
              </p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">{error}</div>
            )}

            <button
              type="submit"
              disabled={isPending}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-semibold py-3 rounded-xl text-sm transition-colors"
            >
              {isPending ? 'Katılınıyor...' : 'Okula Katıl'}
            </button>
          </form>
        )}

        {/* Create */}
        {tab === 'create' && (
          <form onSubmit={handleSubmit(setupSchool)} className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                Okul Adı
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                minLength={2}
                maxLength={120}
                placeholder="Örn: Atatürk İlkokulu"
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <p className="text-xs text-gray-400 mt-1.5">
                Okul oluşturduğunuzda size özel bir kod verilir. Öğretmenleri bu kodla davet edebilirsiniz.
              </p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">{error}</div>
            )}

            <button
              type="submit"
              disabled={isPending}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-semibold py-3 rounded-xl text-sm transition-colors"
            >
              {isPending ? 'Oluşturuluyor...' : 'Okulu Kur ve Başla'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
