'use client'

import { useState, useActionState } from 'react'
import { inviteUser } from '@/src/domains/users/actions'
import type { Role } from '@/lib/types'

const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: 'mudur_yardimcisi', label: 'Müdür Yardımcısı' },
  { value: 'zumre_baskani',    label: 'Zümre Başkanı' },
  { value: 'ogretmen',         label: 'Öğretmen' },
]

export default function InviteUserForm({ canAssignRoles }: { canAssignRoles: Role[] }) {
  const [open, setOpen] = useState(false)
  const [state, action, pending] = useActionState(
    async (_: unknown, fd: FormData) => {
      const res = await inviteUser(_, fd)
      return res
    },
    null
  )

  const options = ROLE_OPTIONS.filter(r => canAssignRoles.includes(r.value))
  const defaultRole = options[options.length - 1]?.value ?? 'ogretmen'

  return (
    <div>
      <button
        onClick={() => setOpen(v => !v)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
        </svg>
        Kullanıcı Ekle
      </button>

      {open && (
        <div className="mt-4 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4">
          {state?.success ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <p className="text-sm font-semibold">Kullanıcı oluşturuldu.</p>
              </div>
              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-700 rounded-lg p-3">
                <p className="text-xs text-amber-700 dark:text-amber-300 mb-1.5">
                  Geçici şifreyi kullanıcıyla paylaşın. Bu ekrandan sonra görüntülenemez:
                </p>
                <TempPasswordDisplay password={state.tempPassword!} />
              </div>
              <button
                onClick={() => { setOpen(false) }}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                Kapat
              </button>
            </div>
          ) : (
            <form action={action} className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300">Yeni Kullanıcı</h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1">E-posta *</label>
                  <input
                    name="email"
                    type="email"
                    required
                    placeholder="ornek@okul.com"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1">Ad Soyad *</label>
                  <input
                    name="full_name"
                    type="text"
                    required
                    minLength={2}
                    placeholder="Ad Soyad"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1">Branş</label>
                  <input
                    name="subject"
                    type="text"
                    placeholder="Matematik, Türkçe…"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1">Rol *</label>
                  <select
                    name="role"
                    defaultValue={defaultRole}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {options.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {state?.error && (
                <p className="text-xs text-red-500">{state.error}</p>
              )}

              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={pending}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  {pending ? 'Oluşturuluyor...' : 'Hesap Oluştur'}
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-slate-600 text-sm text-gray-600 dark:text-slate-400 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                >
                  İptal
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  )
}

function TempPasswordDisplay({ password }: { password: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="flex items-center gap-2">
      <code className="flex-1 font-mono text-sm font-bold tracking-widest text-gray-900 dark:text-slate-100 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded px-3 py-2">
        {password}
      </code>
      <button
        onClick={() => {
          navigator.clipboard.writeText(password).then(() => {
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
          })
        }}
        className="shrink-0 px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-xs text-gray-600 dark:text-slate-400 hover:border-blue-300 hover:text-blue-600 transition-colors"
      >
        {copied ? '✓ Kopyalandı' : 'Kopyala'}
      </button>
    </div>
  )
}
