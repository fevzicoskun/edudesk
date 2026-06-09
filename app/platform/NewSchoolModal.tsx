'use client'

import { useActionState, useState } from 'react'
import { createSchool } from './actions'

export default function NewSchoolModal() {
  const [open, setOpen] = useState(false)
  const [state, action, pending] = useActionState(
    async (prev: { error?: string; ok?: boolean } | null, fd: FormData) => {
      const res = await createSchool(prev, fd)
      if (res.ok) setOpen(false)
      return res
    },
    null
  )

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="bg-violet-600 hover:bg-violet-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
      >
        + Yeni Okul
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between">
              <h2 className="font-semibold text-white">Yeni Okul Ekle</h2>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-white transition-colors text-xl leading-none">×</button>
            </div>

            <form action={action} className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Okul Adı</label>
                <input name="name" required placeholder="Bahçeşehir Koleji İstanbul"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Slug <span className="text-slate-500">(ABC123)</span></label>
                  <input name="slug" required placeholder="IST001" pattern="[A-Z]{3,4}[0-9]{3,4}"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 uppercase" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Durum</label>
                  <select name="status" defaultValue="trial"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500">
                    <option value="trial">Trial</option>
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>
              </div>

              <div className="border-t border-slate-800 pt-4">
                <p className="text-xs text-slate-500 mb-3">Müdür Daveti <span className="text-slate-600">(opsiyonel)</span></p>
                <div className="space-y-3">
                  <input name="mudur_email" type="email" placeholder="mudur@okul.com"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500" />
                  <input name="mudur_name" placeholder="Ahmet Yılmaz"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500" />
                </div>
              </div>

              {state?.error && (
                <p className="text-sm text-red-400 bg-red-950/50 border border-red-900 rounded-lg px-3 py-2">{state.error}</p>
              )}

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setOpen(false)}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                  İptal
                </button>
                <button type="submit" disabled={pending}
                  className="flex-1 bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                  {pending ? 'Oluşturuluyor...' : 'Oluştur'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
