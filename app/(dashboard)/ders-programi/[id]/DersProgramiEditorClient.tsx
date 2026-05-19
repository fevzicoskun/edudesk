'use client'

import { useState, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { updateScheduleFile } from '@/app/actions/schedules'
import { createClient } from '@/lib/supabase/client'

const ACCEPTED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']

function isPdf(url: string) {
  return url.toLowerCase().includes('.pdf') || url.toLowerCase().includes('pdf')
}

export default function DersProgramiEditorClient({
  scheduleId,
  currentFileUrl,
  currentFileName,
  schoolId,
}: {
  scheduleId: string
  currentFileUrl: string | null
  currentFileName: string | null
  schoolId: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [file, setFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleFileDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f && ACCEPTED_TYPES.includes(f.type)) { setFile(f); setError(''); setSaved(false) }
    else setError('Sadece PDF, JPG veya PNG kabul edilir.')
  }

  async function handleUpload() {
    if (!file) return
    setUploading(true)
    setError('')
    try {
      const supabase = createClient()
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const path = `${schoolId}/${Date.now()}_${safeName}`
      const { error: uploadError } = await supabase.storage.from('schedule-files').upload(path, file, { upsert: true })
      if (uploadError) throw new Error(uploadError.message)
      const { data: { publicUrl } } = supabase.storage.from('schedule-files').getPublicUrl(path)
      await updateScheduleFile(scheduleId, publicUrl, file.name)
      setSaved(true)
      setFile(null)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Yükleme başarısız.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* Current file preview */}
      {currentFileUrl && (
        <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-slate-700">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 24 24">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zM14 3.5L18.5 8H14V3.5zM6 20V4h6v6h6v10H6z"/>
              </svg>
              <span className="text-sm font-medium text-gray-700 dark:text-slate-300 truncate max-w-xs">{currentFileName ?? 'Dosya'}</span>
            </div>
            <a
              href={currentFileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 dark:text-blue-400 font-medium hover:underline"
            >
              Yeni Sekmede Aç ↗
            </a>
          </div>
          {isPdf(currentFileUrl) ? (
            <iframe
              src={currentFileUrl}
              className="w-full border-0"
              style={{ height: '70vh', minHeight: '400px' }}
              title="Ders Programı"
            />
          ) : (
            <div className="p-4">
              <img src={currentFileUrl} alt="Ders Programı" className="w-full rounded-lg object-contain max-h-[70vh]" />
            </div>
          )}
        </div>
      )}

      {/* Upload new file */}
      <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3">
          {currentFileUrl ? 'Dosyayı Güncelle' : 'Dosya Yükle'}
        </h3>
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleFileDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
            dragOver
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30'
              : file
              ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-950/20'
              : 'border-gray-300 dark:border-slate-600 hover:border-blue-400 hover:bg-gray-50 dark:hover:bg-slate-700/50'
          }`}
        >
          <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={e => {
            const f = e.target.files?.[0]
            if (f && ACCEPTED_TYPES.includes(f.type)) { setFile(f); setError(''); setSaved(false) }
          }} className="sr-only" />
          {file ? (
            <div>
              <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">{file.name}</p>
              <p className="text-xs text-gray-400 mt-1">{(file.size / 1024 / 1024).toFixed(1)} MB · Değiştirmek için tıklayın</p>
            </div>
          ) : (
            <div>
              <p className="text-sm text-gray-500 dark:text-slate-400">
                <span className="font-medium text-blue-600 dark:text-blue-400">Sürükleyin</span> veya tıklayın
              </p>
              <p className="text-xs text-gray-400 mt-1">PDF, JPG, PNG — maks 20 MB</p>
            </div>
          )}
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400 mt-2">{error}</p>}
        {saved && <p className="text-sm text-emerald-600 dark:text-emerald-400 mt-2">Dosya güncellendi.</p>}

        {file && (
          <button
            onClick={handleUpload}
            disabled={uploading}
            className="mt-3 w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {uploading ? 'Yükleniyor...' : 'Yükle ve Güncelle'}
          </button>
        )}
      </div>
    </div>
  )
}
