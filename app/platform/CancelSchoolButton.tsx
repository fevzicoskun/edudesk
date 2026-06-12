'use client'

import { useState, useRef, useTransition } from 'react'
import { cancelSchool } from './actions'

export default function CancelSchoolButton({
  schoolId,
  schoolName,
}: {
  schoolId: string
  schoolName: string
}) {
  const [open, setOpen]       = useState(false)
  const [inputVal, setInputVal] = useState('')
  const [isPending, start]    = useTransition()
  const inputRef              = useRef<HTMLInputElement>(null)

  function handleOpen() {
    setInputVal('')
    setOpen(true)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  function handleConfirm() {
    if (inputVal !== schoolName) return
    start(async () => {
      await cancelSchool(schoolId)
      setOpen(false)
    })
  }

  return (
    <>
      <button
        onClick={handleOpen}
        className="text-xs text-red-400 hover:text-red-300 px-2.5 py-1.5 rounded-lg border border-red-900/50 hover:bg-red-950/40 transition-colors"
      >
        Kapat
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={e => { if (e.target === e.currentTarget) setOpen(false) }}
        >
          <div className="bg-slate-900 border border-red-900/50 rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="px-6 py-5 border-b border-slate-800">
              <h2 className="font-semibold text-white">Hesabı Kapat</h2>
              <p className="text-xs text-slate-400 mt-1">
                Bu işlem okul üyelerinin platforma erişimini engeller. Geri alınabilir.
              </p>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div>
                <p className="text-sm text-slate-300 mb-2">Onaylamak için okul adını tam yazın:</p>
                <p className="font-mono text-red-400 text-xs bg-red-950/20 border border-red-900/40 rounded px-2 py-1">
                  {schoolName}
                </p>
              </div>

              <input
                ref={inputRef}
                value={inputVal}
                onChange={e => setInputVal(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleConfirm()}
                placeholder="Okul adını yazın..."
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
              />

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  İptal
                </button>
                <button
                  type="button"
                  disabled={inputVal !== schoolName || isPending}
                  onClick={handleConfirm}
                  className="flex-1 bg-red-700 hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  {isPending ? 'İşleniyor...' : 'Hesabı Kapat'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
