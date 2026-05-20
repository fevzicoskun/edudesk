'use client'

import { useState, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createScheduleWithFile } from '@/app/actions/schedules'
import { createClient } from '@/src/infrastructure/supabase/client'

type Teacher = { id: string; full_name: string | null; subject: string | null }
type Cls = { id: string; name: string; grade: number }

const ACCEPTED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']

export default function YeniProgramForm({
  teachers,
  classes,
  okulLabel,
  schoolId,
}: {
  teachers: Teacher[]
  classes: Cls[]
  okulLabel: string
  schoolId: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [scheduleType, setScheduleType] = useState<'resmi' | 'okul'>('resmi')
  const [targetType, setTargetType] = useState<'ogretmen' | 'sinif'>('ogretmen')
  const [teacherId, setTeacherId] = useState('')
  const [classId, setClassId] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleFileDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f && ACCEPTED_TYPES.includes(f.type)) {
      setFile(f)
      setError('')
    } else {
      setError('Sadece PDF, JPG veya PNG dosyaları kabul edilir.')
    }
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (f && ACCEPTED_TYPES.includes(f.type)) {
      setFile(f)
      setError('')
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (targetType === 'ogretmen' && !teacherId) { setError('Öğretmen seçiniz.'); return }
    if (targetType === 'sinif' && !classId) { setError('Sınıf seçiniz.'); return }
    if (!file) { setError('Lütfen bir dosya seçin veya sürükleyin.'); return }

    setUploading(true)
    try {
      const supabase = createClient()
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const path = `${schoolId}/${Date.now()}_${safeName}`

      const { error: uploadError } = await supabase.storage
        .from('schedule-files')
        .upload(path, file, { upsert: true })

      if (uploadError) throw new Error(`Dosya yüklenemedi: ${uploadError.message}`)

      const { data: { publicUrl } } = supabase.storage
        .from('schedule-files')
        .getPublicUrl(path)

      await createScheduleWithFile({
        schedule_type: scheduleType,
        type_label: scheduleType === 'resmi' ? 'Resmi Ders Programı' : okulLabel,
        teacher_id: targetType === 'ogretmen' ? teacherId : null,
        class_id: targetType === 'sinif' ? classId : null,
        file_url: publicUrl,
        file_name: file.name,
      })

      router.push('/ders-programi')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bir hata oluştu, tekrar deneyin.')
      setUploading(false)
    }
  }

  const busy = pending || uploading

  return (
    <form onSubmit={handleSubmit} className="space-y-5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-5">

      {/* Program türü */}
      <fieldset>
        <legend className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">Program Türü</legend>
        <div className="grid grid-cols-2 gap-3">
          {(['resmi', 'okul'] as const).map(t => (
            <label key={t} className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors ${
              scheduleType === t ? 'border-blue-500 bg-blue-50 dark:bg-blue-950' : 'border-gray-200 dark:border-slate-700'
            }`}>
              <input type="radio" name="scheduleType" value={t} checked={scheduleType === t}
                onChange={() => setScheduleType(t)} className="sr-only" />
              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${scheduleType === t ? 'border-blue-500' : 'border-gray-300 dark:border-slate-500'}`}>
                {scheduleType === t && <div className="w-2 h-2 rounded-full bg-blue-500" />}
              </div>
              <span className="text-sm font-medium text-gray-900 dark:text-slate-100">
                {t === 'resmi' ? 'Resmi Ders Programı' : okulLabel}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {/* Hedef türü */}
      <fieldset>
        <legend className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">Program Kime Ait?</legend>
        <div className="grid grid-cols-2 gap-3">
          {(['ogretmen', 'sinif'] as const).map(t => (
            <label key={t} className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors ${
              targetType === t ? 'border-blue-500 bg-blue-50 dark:bg-blue-950' : 'border-gray-200 dark:border-slate-700'
            }`}>
              <input type="radio" name="targetType" value={t} checked={targetType === t}
                onChange={() => setTargetType(t)} className="sr-only" />
              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${targetType === t ? 'border-blue-500' : 'border-gray-300 dark:border-slate-500'}`}>
                {targetType === t && <div className="w-2 h-2 rounded-full bg-blue-500" />}
              </div>
              <span className="text-sm font-medium text-gray-900 dark:text-slate-100">
                {t === 'ogretmen' ? 'Öğretmen Bazında' : 'Sınıf Bazında'}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {/* Target selector */}
      {targetType === 'ogretmen' ? (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Öğretmen</label>
          <select value={teacherId} onChange={e => setTeacherId(e.target.value)}
            className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent">
            <option value="">— Öğretmen seçin —</option>
            {teachers.map(t => (
              <option key={t.id} value={t.id}>{t.full_name ?? t.id}{t.subject ? ` — ${t.subject}` : ''}</option>
            ))}
          </select>
        </div>
      ) : (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Sınıf</label>
          <select value={classId} onChange={e => setClassId(e.target.value)}
            className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent">
            <option value="">— Sınıf seçin —</option>
            {classes.map(c => (
              <option key={c.id} value={c.id}>{c.grade}. Sınıf — {c.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Drag-and-drop file upload */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Program Dosyası (PDF veya Resim)</label>
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleFileDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
            dragOver
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30'
              : file
              ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-950/20'
              : 'border-gray-300 dark:border-slate-600 hover:border-blue-400 hover:bg-gray-50 dark:hover:bg-slate-700/50'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            onChange={handleFileInput}
            className="sr-only"
          />
          {file ? (
            <div className="flex flex-col items-center gap-2">
              <svg className="w-10 h-10 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">{file.name}</p>
              <p className="text-xs text-gray-400">{(file.size / 1024 / 1024).toFixed(1)} MB · Değiştirmek için tıklayın</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <svg className="w-10 h-10 text-gray-300 dark:text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              <p className="text-sm text-gray-500 dark:text-slate-400">
                <span className="font-medium text-blue-600 dark:text-blue-400">Dosyayı sürükleyin</span> veya seçmek için tıklayın
              </p>
              <p className="text-xs text-gray-400">PDF, JPG, PNG — maks 20 MB</p>
            </div>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="flex gap-3 pt-1">
        <button
          type="submit"
          disabled={busy || !file}
          className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
        >
          {uploading ? 'Yükleniyor...' : busy ? 'Kaydediliyor...' : 'Yükle ve Kaydet'}
        </button>
        <button type="button" onClick={() => router.back()}
          className="px-4 py-2.5 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 text-sm font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
          Geri
        </button>
      </div>
    </form>
  )
}
