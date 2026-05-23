'use client'

import { useActionState } from 'react'
import { provisionSchool } from '@/app/actions/admin'

const inputCls = 'w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 placeholder:text-gray-400'

export default function ProvisionForm() {
  const [state, formAction, isPending] = useActionState(provisionSchool, null)

  if (state?.success && !state.error) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl px-5 py-4 text-sm text-green-700">
        Okul oluşturuldu. Müdüre davet e-postası gönderildi.
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
        <label className="block text-sm font-medium text-gray-700 mb-1">Okul Adı</label>
        <input name="school_name" type="text" required minLength={2} maxLength={200}
          placeholder="ör. Atatürk Anadolu Lisesi" className={inputCls} />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Müdür Adı Soyadı</label>
        <input name="mudur_name" type="text" required minLength={2}
          placeholder="Ahmet Yılmaz" className={inputCls} />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Müdür E-posta</label>
        <input name="mudur_email" type="email" required
          placeholder="mudur@okul.com" className={inputCls} />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full bg-indigo-600 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors"
      >
        {isPending ? 'Oluşturuluyor...' : 'Okul ve Müdür Oluştur'}
      </button>
    </form>
  )
}
