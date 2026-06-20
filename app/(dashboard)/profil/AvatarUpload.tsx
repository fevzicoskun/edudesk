'use client'

import { useRef, useState } from 'react'
import Avatar from '@/app/components/Avatar'
import { resizeImage } from '@/src/shared/image/resizeImage'
import { uploadAvatar, removeAvatar } from '@/app/actions/avatar'

export default function AvatarUpload({
  name,
  initialUrl,
}: {
  name: string
  initialUrl: string | null
}) {
  const [url, setUrl] = useState<string | null>(initialUrl)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) { setErr('Lütfen bir görsel dosyası seç'); return }
    if (file.size > 5 * 1024 * 1024) { setErr('Dosya 5 MB\'tan küçük olmalı'); return }
    setErr(null)
    setBusy(true)
    try {
      const blob = await resizeImage(file)
      const fd = new FormData()
      fd.append('file', blob, 'avatar.webp')
      const res = await uploadAvatar(fd)
      if (res.error || !res.url) throw new Error(res.error ?? 'Kaydedilemedi')
      setUrl(`${res.url}?t=${Date.now()}`) // cache-bust: yeni foto anında görünsün
    } catch (e) {
      setErr('Yüklenemedi: ' + (e instanceof Error ? e.message : 'bilinmeyen hata'))
    } finally {
      setBusy(false)
    }
  }

  async function onRemove() {
    setBusy(true)
    setErr(null)
    const res = await removeAvatar()
    if (res.error) setErr(res.error)
    else setUrl(null)
    setBusy(false)
  }

  return (
    <div className="flex flex-col items-center gap-2 shrink-0">
      <Avatar name={name} src={url} size="lg" />
      <input ref={fileRef} type="file" accept="image/*" onChange={onPick} className="hidden" />
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="text-xs px-2.5 py-1 rounded-lg border border-gray-300 dark:border-slate-600 text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 disabled:opacity-50 transition-colors"
        >
          {busy ? '…' : url ? 'Değiştir' : 'Fotoğraf ekle'}
        </button>
        {url && !busy && (
          <button
            type="button"
            onClick={onRemove}
            className="text-xs text-red-600 dark:text-red-400 hover:underline"
          >
            Kaldır
          </button>
        )}
      </div>
      {err && <p className="text-xs text-red-600 dark:text-red-400 max-w-[160px] text-center">{err}</p>}
    </div>
  )
}
