'use client'

import { useActionState } from 'react'
import { updateHomework } from '@/app/actions/homework'
import Link from 'next/link'

type HwData = {
  id: string
  title: string
  subject: string
  description: string | null
  due_date: string | null
  source_id: string | null
}

type SourceItem = { id: string; name: string; subject: string | null }

const field =
  'w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-base text-gray-900 placeholder:text-gray-400 hover:border-gray-300 focus:outline-none focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 transition-all duration-200'

export default function OdevDuzenleForm({ hw, sources }: { hw: HwData; sources: SourceItem[] }) {
  const [state, formAction, isPending] = useActionState(updateHomework, null)

  return (
    <div className="rounded-2xl overflow-hidden bg-white shadow-xl shadow-gray-200/70 border border-gray-100/80">
      <div className="relative bg-gradient-to-br from-slate-600 via-slate-600 to-slate-700 px-6 py-5">
        <p className="text-white font-semibold text-lg">Ödevi Düzenle</p>
        <p className="text-slate-300 text-sm mt-0.5">Başlık, ders, açıklama ve tarihi güncelleyin</p>
      </div>

      <form action={formAction}>
        <input type="hidden" name="id" value={hw.id} />
        <div className="p-6 space-y-5">

          {state?.error && (
            <div className="flex items-start gap-3 bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl px-4 py-3.5">
              <svg className="w-4 h-4 mt-0.5 shrink-0 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
              {state.error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">Ders</label>
              <input name="subject" type="text" required className={field} defaultValue={hw.subject} />
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">Son Teslim Tarihi</label>
              <input
                name="due_date"
                type="date"
                className={field}
                defaultValue={hw.due_date ?? ''}
                min={hw.due_date && hw.due_date < new Date().toISOString().split('T')[0] ? undefined : new Date().toISOString().split('T')[0]}
              />
              {hw.due_date && hw.due_date < new Date().toISOString().split('T')[0] && (
                <p className="text-xs text-amber-600">Geçmiş tarih — değiştirmek zorunda değilsiniz.</p>
              )}
            </div>
          </div>

          {sources.length > 0 && (
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Kaynak <span className="text-gray-400 font-normal normal-case tracking-normal">(opsiyonel)</span>
              </label>
              <select name="source_id" className={field} defaultValue={hw.source_id ?? ''}>
                <option value="">Kaynak seçin</option>
                {sources.map(s => (
                  <option key={s.id} value={s.id}>{s.name}{s.subject ? ` (${s.subject})` : ''}</option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-2">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">Başlık</label>
            <input name="title" type="text" required className={field} defaultValue={hw.title} />
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Açıklama <span className="text-gray-400 font-normal normal-case tracking-normal">(opsiyonel)</span>
            </label>
            <textarea
              name="description"
              rows={3}
              className={`${field} resize-none`}
              defaultValue={hw.description ?? ''}
            />
          </div>

        </div>

        <div className="px-6 py-4 bg-gray-50/70 border-t border-gray-100 flex flex-col-reverse sm:flex-row gap-3">
          <Link
            href={`/odevler/${hw.id}`}
            className="flex-1 text-center px-5 py-3 border border-gray-200 bg-white rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-all"
          >
            İptal
          </Link>
          <button
            type="submit"
            disabled={isPending}
            className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-slate-700 to-slate-800 hover:from-slate-800 hover:to-slate-900 text-white px-5 py-3 rounded-xl text-sm font-semibold shadow-lg shadow-slate-500/20 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
          >
            {isPending ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Kaydediliyor...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Kaydet
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
