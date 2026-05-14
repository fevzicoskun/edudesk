'use client'

import { useState, useTransition } from 'react'
import { updateSchoolSlug } from '@/app/actions/profile'

export default function SchoolCodeCard({ code }: { code: string }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(code)
  const [saved, setSaved] = useState(code)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleCopy() {
    navigator.clipboard.writeText(saved).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function handleSave() {
    setError(null)
    startTransition(async () => {
      const res = await updateSchoolSlug(value)
      if (res?.error) {
        setError(res.error)
      } else {
        setSaved(value)
        setEditing(false)
      }
    })
  }

  function handleCancel() {
    setValue(saved)
    setError(null)
    setEditing(false)
  }

  return (
    <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3">
      <p className="text-xs font-semibold text-indigo-700 mb-1">Okul Katılım Kodu</p>
      <p className="text-xs text-indigo-600 mb-2">
        Bu kodu öğretmenlerinizle paylaşın. Onboarding sırasında &quot;Okula Katıl&quot; seçeneğiyle girecekler.
      </p>

      {editing ? (
        <div className="space-y-2">
          <input
            value={value}
            onChange={e => setValue(e.target.value)}
            className="w-full bg-white border border-indigo-300 rounded-lg px-3 py-2 text-sm font-mono text-indigo-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="okul-kodum"
            autoFocus
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={isPending}
              className="flex-1 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-xs font-medium rounded-lg transition-colors"
            >
              {isPending ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
            <button
              onClick={handleCancel}
              disabled={isPending}
              className="px-3 py-2 bg-white border border-indigo-200 hover:bg-indigo-50 text-indigo-700 text-xs font-medium rounded-lg transition-colors"
            >
              İptal
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <code className="flex-1 bg-white border border-indigo-200 rounded-lg px-3 py-2 text-sm font-mono text-indigo-900 select-all">
            {saved}
          </code>
          <button
            onClick={handleCopy}
            className="shrink-0 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-lg transition-colors"
          >
            {copied ? 'Kopyalandı!' : 'Kopyala'}
          </button>
          <button
            onClick={() => setEditing(true)}
            className="shrink-0 px-3 py-2 bg-white border border-indigo-200 hover:bg-indigo-50 text-indigo-700 text-xs font-medium rounded-lg transition-colors"
          >
            Düzenle
          </button>
        </div>
      )}
    </div>
  )
}
