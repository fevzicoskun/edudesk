'use client'

import { saveNotificationPreferences } from '@/src/domains/notifications/actions'
import { useRef } from 'react'

interface Props {
  defaultDays: number
  defaultEmailOn: boolean
}

export default function BildirimTercihleri({ defaultDays, defaultEmailOn }: Props) {
  const formRef = useRef<HTMLFormElement>(null)

  return (
    <div className="px-4 md:px-6 pb-6 max-w-lg mx-auto">
      <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-4">Bildirim Tercihleri</h2>
        <form ref={formRef} action={saveNotificationPreferences} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-600 dark:text-slate-400 mb-1">
              Ödev son tarihinden kaç gün önce bildirim gelsin?
            </label>
            <select
              name="days_before"
              defaultValue={defaultDays}
              className="px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {[1, 2, 3, 5, 7].map(d => (
                <option key={d} value={d}>
                  {d} gün önce
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="email_on"
              name="email_on"
              defaultChecked={defaultEmailOn}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="email_on" className="text-sm text-gray-600 dark:text-slate-400">
              Email bildirimi gönder
            </label>
          </div>
          <button
            type="submit"
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            Kaydet
          </button>
        </form>
      </div>
    </div>
  )
}
