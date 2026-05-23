'use client'

import { useActionState } from 'react'
import { updateVeliContact } from '@/src/domains/classes/actions'

interface Props {
  studentId: string
  classId: string
  defaultEmail: string
  defaultTelefon: string
}

export default function VeliIletisimForm({ studentId, classId, defaultEmail, defaultTelefon }: Props) {
  const [state, action, pending] = useActionState(
    async (_prev: { ok: boolean } | null, formData: FormData) => {
      await updateVeliContact(studentId, classId, formData)
      return { ok: true }
    },
    null
  )

  return (
    <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-4 mb-4">
      <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3">Veli İletişim</h2>
      <form action={action} className="flex flex-col gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <label className="text-sm text-gray-600 dark:text-slate-400 w-24 shrink-0">E-posta</label>
          <input
            name="veli_email"
            type="email"
            defaultValue={defaultEmail}
            placeholder="veli@ornek.com"
            className="flex-1 min-w-40 px-3 py-1.5 border border-gray-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <label className="text-sm text-gray-600 dark:text-slate-400 w-24 shrink-0">WhatsApp</label>
          <input
            name="veli_telefon"
            type="tel"
            defaultValue={defaultTelefon}
            placeholder="905XX000000"
            className="flex-1 min-w-40 px-3 py-1.5 border border-gray-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex items-center gap-3 mt-1">
          <button
            type="submit"
            disabled={pending}
            className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-60"
          >
            {pending ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
          {state?.ok && (
            <span className="text-sm text-green-600 dark:text-green-400">Kaydedildi</span>
          )}
        </div>
      </form>
    </div>
  )
}
