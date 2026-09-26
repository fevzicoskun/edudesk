'use client'

import { createContext, useContext, useState, useEffect, useTransition, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { bulkDeleteHomeworks, restoreHomeworks } from '@/app/actions/homework'

type BulkCtx = {
  bulkMode: boolean
  selected: Set<string>
  toggle: (id: string) => void
  setBulkMode: (v: boolean) => void
  /** Tekli silme sonrası da aynı "Geri al" bildirimi gösterilsin */
  bildirSilindi: (ids: string[]) => void
  /** Silinip henüz geri alınmamış ödevler — kart gizliliğinin TEK kaynağı (geri al burayı temizler) */
  gizli: Set<string>
}

const BulkContext = createContext<BulkCtx | null>(null)

export function useBulk() {
  return useContext(BulkContext)
}

export function BulkProvider({ children }: { children: ReactNode }) {
  const [bulkMode, setBulkModeState] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [isPending, startTransition] = useTransition()
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [result, setResult] = useState<{ deleted: number; skipped: number; ids: string[] } | null>(null)
  const [geriAliniyor, setGeriAliniyor] = useState(false)
  const [geriAlHata, setGeriAlHata] = useState<string | null>(null)
  const [gizli, setGizli] = useState<Set<string>>(new Set())
  const router = useRouter()

  useEffect(() => {
    if (!result) return
    // Geri al süresi: 10 sn (yanlış silmeyi fark etmeye yetsin)
    const t = setTimeout(() => setResult(null), 10_000)
    return () => clearTimeout(t)
  }, [result])

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function setBulkMode(v: boolean) {
    setBulkModeState(v)
    if (!v) {
      setSelected(new Set())
      setConfirmingDelete(false)
    }
  }

  function handleDelete() {
    if (!confirmingDelete) {
      setConfirmingDelete(true)
      return
    }
    const count = selected.size
    startTransition(async () => {
      const res = await bulkDeleteHomeworks([...selected])
      setBulkMode(false)
      setConfirmingDelete(false)
      // Kısmi başarı sessiz kalmasın: silinmeyen ödev varsa kullanıcı görsün
      setResult(res.error
        ? { deleted: 0, skipped: count, ids: [] }
        : { deleted: res.deleted, skipped: res.skipped, ids: res.deletedIds ?? [] })
      router.refresh()
    })
  }

  function bildirSilindi(ids: string[]) {
    setGeriAlHata(null)
    setGizli(prev => new Set([...prev, ...ids]))
    setResult({ deleted: ids.length, skipped: 0, ids })
  }

  function geriAl() {
    if (!result?.ids.length) return
    const ids = result.ids
    setGeriAliniyor(true)
    startTransition(async () => {
      const res = await restoreHomeworks(ids)
      setGeriAliniyor(false)
      if (res.error) {
        setGeriAlHata(res.restored > 0 ? `${res.restored} ödev geri alındı, bazıları alınamadı.` : 'Geri alınamadı.')
      } else {
        setResult(null)
        setGizli(prev => new Set([...prev].filter(id => !ids.includes(id))))
      }
      router.refresh()
    })
  }

  return (
    <BulkContext.Provider value={{ bulkMode, selected, toggle, setBulkMode, bildirSilindi, gizli }}>
      {children}

      {/* Silme sonucu — kaç ödev silindi, kaçı atlandı */}
      {result && (
        <div
          role="status"
          className={`fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-[100] flex items-center text-sm font-medium px-4 py-3 rounded-2xl shadow-2xl ${
            result.deleted === 0
              ? 'bg-red-600 text-white'
              : result.skipped > 0
                ? 'bg-amber-600 text-white'
                : 'bg-gray-900 dark:bg-slate-700 text-white'
          }`}
        >
          <span>
            {geriAlHata ?? (result.deleted === 0
              ? 'Hiçbir ödev silinemedi — yalnızca kendi ödevlerinizi silebilirsiniz.'
              : result.skipped > 0
                ? `${result.deleted} ödev silindi · ${result.skipped} ödev size ait olmadığı için silinemedi.`
                : `${result.deleted} ödev silindi.`)}
          </span>
          {result.ids.length > 0 && !geriAlHata && (
            <button
              type="button"
              onClick={geriAl}
              disabled={geriAliniyor}
              className="ml-3 font-semibold underline underline-offset-2 hover:no-underline disabled:opacity-60"
            >
              {geriAliniyor ? 'Geri alınıyor…' : 'Geri al'}
            </button>
          )}
        </div>
      )}

      {/* Floating action bar */}
      {bulkMode && (
        <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 bg-gray-900 dark:bg-slate-700 text-white rounded-2xl shadow-2xl px-4 py-3">
          {confirmingDelete ? (
            <>
              <span className="text-sm font-medium whitespace-nowrap text-red-300">
                {selected.size} ödev silinecek!
              </span>
              <button
                onClick={() => setConfirmingDelete(false)}
                className="text-xs text-gray-400 hover:text-white transition-colors whitespace-nowrap"
              >
                İptal
              </button>
              <button
                onClick={handleDelete}
                disabled={isPending}
                className="flex items-center gap-1.5 bg-red-500 hover:bg-red-600 disabled:opacity-60 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
              >
                {isPending ? 'Siliniyor...' : 'Onayla — Sil'}
              </button>
            </>
          ) : (
            <>
              <span className="text-sm font-medium whitespace-nowrap">
                {selected.size > 0 ? `${selected.size} ödev seçildi` : 'Ödev seç'}
              </span>
              {selected.size > 0 && (
                <button
                  onClick={handleDelete}
                  disabled={isPending}
                  className="flex items-center gap-1.5 bg-red-500 hover:bg-red-600 disabled:opacity-60 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Seçilenleri Sil
                </button>
              )}
              <button
                onClick={() => setBulkMode(false)}
                className="text-xs text-gray-400 hover:text-white transition-colors"
              >
                İptal
              </button>
            </>
          )}
        </div>
      )}
    </BulkContext.Provider>
  )
}

export function BulkModeToggle({ canWrite }: { canWrite: boolean }) {
  const bulk = useBulk()
  if (!canWrite || !bulk) return null

  return (
    <button
      onClick={() => bulk.setBulkMode(!bulk.bulkMode)}
      aria-pressed={bulk.bulkMode}
      className={`shrink-0 px-2 py-1.5 rounded-lg text-sm font-medium transition-colors ${
        bulk.bulkMode
          ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'
          : 'text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-slate-100'
      }`}
    >
      {bulk.bulkMode ? 'Seçimi bitir' : 'Toplu seç'}
    </button>
  )
}
