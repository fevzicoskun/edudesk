'use client'

import { useState, useTransition } from 'react'
import { changeUserEmail } from '@/src/domains/users/actions'

/** Kullanıcının giriş e-postasını gösterir; düzenleyebilen için yerinde değiştirme. Hesap ve verisi aynı kalır. */
export default function EpostaDegistir({ userId, userName, email, duzenlenebilir }: {
  userId: string; userName: string; email: string | null; duzenlenebilir: boolean
}) {
  const [acik, setAcik] = useState(false)
  const [deger, setDeger] = useState(email ?? '')
  const [hata, setHata] = useState<string | null>(null)
  const [tamam, setTamam] = useState(false)
  const [isPending, startTransition] = useTransition()

  if (!acik) {
    return (
      <p className="text-xs text-gray-500 dark:text-slate-400 flex items-center gap-2 flex-wrap">
        <span className="break-all">{email ?? '—'}</span>
        {tamam && <span role="status" className="text-emerald-700 dark:text-emerald-400">✓ Güncellendi</span>}
        {duzenlenebilir && (
          <button type="button" onClick={() => { setAcik(true); setTamam(false); setHata(null); setDeger(email ?? '') }}
            className="text-indigo-600 dark:text-indigo-400 font-medium hover:underline">
            E-postayı değiştir
          </button>
        )}
      </p>
    )
  }

  const kaydet = () => startTransition(async () => {
    const r = await changeUserEmail(userId, deger)
    if (r.error) { setHata(r.error); return }
    setAcik(false); setTamam(true)
  })

  return (
    <form className="mt-1 flex items-center gap-1.5 flex-wrap" onSubmit={e => { e.preventDefault(); kaydet() }}>
      <input type="email" required autoFocus value={deger} onChange={e => setDeger(e.target.value)}
        aria-label={`${userName} yeni e-posta`}
        className="text-sm px-2 py-1 rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 min-w-0 w-56" />
      <button type="submit" disabled={isPending}
        className="text-xs px-2 py-1 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50">
        {isPending ? '...' : 'Kaydet'}
      </button>
      <button type="button" onClick={() => setAcik(false)}
        className="text-xs px-2 py-1 border border-gray-300 dark:border-slate-600 rounded-md text-gray-600 dark:text-slate-400">
        İptal
      </button>
      {hata && <span role="alert" className="text-xs text-red-600 dark:text-red-400 w-full">{hata}</span>}
    </form>
  )
}
