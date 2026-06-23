'use client'

import { useState, useTransition } from 'react'
import { generateBulkVeliTokens, type BulkTokenResult } from '@/app/actions/tokens'
import { buildWhatsAppUrl } from '@/src/domains/classes/lib/veliPortal'

interface Props { classId: string }

export default function BulkVeliLinkModal({ classId }: Props) {
  const [open,    setOpen]    = useState(false)
  const [results, setResults] = useState<(BulkTokenResult & { url: string })[]>([])
  const [copied,  setCopied]  = useState<string | null>(null)
  const [isPending, start]    = useTransition()

  function handleOpen() {
    setOpen(true)
    if (results.length) return
    start(async () => {
      const data   = await generateBulkVeliTokens(classId)
      const origin = window.location.origin
      setResults(data.map(r => ({ ...r, url: `${origin}/veli/${r.token}` })))
    })
  }

  function handleCopy(url: string, id: string) {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(id)
      setTimeout(() => setCopied(null), 2000)
    })
  }

  function handleCopyAll() {
    const text = results.map(r => `${r.studentName}: ${r.url}`).join('\n')
    navigator.clipboard.writeText(text).then(() => {
      setCopied('all')
      setTimeout(() => setCopied(null), 2000)
    })
  }

  if (!open) {
    return (
      <button
        onClick={handleOpen}
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-600 text-sm font-medium text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
        Toplu Veli Linki
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-slate-700">
          <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100">Toplu Veli Linki</h2>
          <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {isPending ? (
            <p className="text-sm text-gray-500 dark:text-slate-400 text-center py-8">Linkler oluşturuluyor…</p>
          ) : results.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-slate-400 text-center py-8">Öğrenci bulunamadı.</p>
          ) : (
            <div className="space-y-2">
              {results.map(r => (
                <div key={r.studentId} className="flex items-center gap-2 p-2 rounded-lg border border-gray-100 dark:border-slate-700">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">{r.studentName}</p>
                    {!r.veliTelefon && (
                      <p className="text-[10px] text-amber-500">Telefon eksik</p>
                    )}
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    {r.veliTelefon && (
                      <a
                        href={buildWhatsAppUrl(r.studentName, r.veliAd, r.url)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-lg border border-green-200 dark:border-green-700 text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-950 transition-colors"
                        title="WhatsApp'ta gönder"
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                          <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.555 4.116 1.524 5.847L0 24l6.337-1.501A11.956 11.956 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.891 0-3.663-.5-5.198-1.374l-.373-.22-3.863.915.977-3.762-.241-.388A9.937 9.937 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
                        </svg>
                      </a>
                    )}
                    <button
                      onClick={() => handleCopy(r.url, r.studentId)}
                      className="p-1.5 rounded-lg border border-gray-200 dark:border-slate-600 text-gray-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                      title="Kopyala"
                    >
                      {copied === r.studentId ? (
                        <svg className="w-3.5 h-3.5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {results.length > 0 && !isPending && (
          <div className="p-4 border-t border-gray-200 dark:border-slate-700">
            <button
              onClick={handleCopyAll}
              className="w-full py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              {copied === 'all' ? 'Kopyalandı ✓' : 'Tümünü Kopyala'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
