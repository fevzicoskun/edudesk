'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { importStudentsFromExcel, type ExcelImportResult } from '@/app/actions/classes'
import { DialogFooter } from '@/components/ui/dialog'

export default function ExcelImportTab({
  classId,
  onClose,
}: {
  classId: string
  onClose: () => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [result, setResult] = useState<ExcelImportResult | null>(null)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setFile(e.target.files?.[0] ?? null)
    setResult(null)
    setError('')
  }

  function handleImport() {
    if (!file) return
    setError('')
    setResult(null)

    const formData = new FormData()
    formData.append('file', file)

    startTransition(async () => {
      try {
        const res = await importStudentsFromExcel(classId, formData)
        setResult(res)
        if (res.added > 0) {
          router.refresh()
          setFile(null)
          if (fileInputRef.current) fileInputRef.current.value = ''
        }
      } catch (e) {
        console.error('[ExcelImportTab]', e)
        setError('Dosya içe aktarılırken hata oluştu. Lütfen tekrar dene.')
      }
    })
  }

  return (
    <>
      <p className="text-sm text-muted-foreground whitespace-pre-line">
        {`e-Okul'dan indirdiğin sınıf listesini (.xlsx) seç.\n"Adı Soyadı" (veya "Adı" + "Soyadı") ve "Okul No" sütunları otomatik tanınır.\nEn fazla 2 MB.`}
      </p>

      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx"
        onChange={handleFileChange}
        className="w-full text-sm text-gray-700 file:mr-3 file:px-4 file:py-2 file:border-0 file:rounded-lg file:bg-blue-50 file:text-blue-700 file:text-sm file:font-medium hover:file:bg-blue-100 file:cursor-pointer cursor-pointer border border-gray-300 rounded-lg p-1.5"
      />

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      {result?.error && (
        <p className="text-sm text-red-600 dark:text-red-400">{result.error}</p>
      )}

      {result && result.added > 0 && (
        <p className="text-sm text-green-600 dark:text-green-400">
          {result.added} öğrenci eklendi.
        </p>
      )}

      {result && result.errors.length > 0 && (
        <div className="max-h-32 overflow-y-auto rounded-lg border border-red-200 bg-red-50 px-3 py-2">
          <p className="text-xs font-medium text-red-700 mb-1">
            {result.errors.length} satır eklenemedi:
          </p>
          <ul className="space-y-0.5">
            {result.errors.map((err) => (
              <li key={`${err.row}-${err.message}`} className="text-xs text-red-600 dark:text-red-400">
                Satır {err.row}: {err.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      <DialogFooter>
        <button
          type="button"
          onClick={onClose}
          className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          {result && result.added > 0 ? 'Kapat' : 'İptal'}
        </button>
        <button
          type="button"
          onClick={handleImport}
          disabled={isPending || !file}
          className="flex-1 bg-blue-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isPending ? 'İçe Aktarılıyor...' : 'İçe Aktar'}
        </button>
      </DialogFooter>
    </>
  )
}
