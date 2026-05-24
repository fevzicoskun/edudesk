'use client'

import { useActionState } from 'react'
import { createHomework } from '@/src/domains/homework/actions'
import Link from 'next/link'

type ClassItem = { id: string; name: string; grade: number }

const field =
  'w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-base text-gray-900 placeholder:text-gray-400 hover:border-gray-300 focus:outline-none focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 transition-all duration-200'

export default function HomeworkForm({ classes }: { classes: ClassItem[] }) {
  const [state, formAction, isPending] = useActionState(createHomework, null)

  return (
    <div className="rounded-2xl overflow-hidden bg-white shadow-xl shadow-gray-200/70 border border-gray-100/80">

      {/* Gradient header */}
      <div className="relative bg-gradient-to-br from-blue-600 via-blue-600 to-indigo-700 px-6 py-6 overflow-hidden">
        <div className="absolute -right-6 -top-6 w-28 h-28 rounded-full bg-white/5" />
        <div className="absolute right-4 -bottom-8 w-20 h-20 rounded-full bg-white/5" />
        <div className="relative flex items-center gap-4">
          <div className="w-11 h-11 bg-white/15 rounded-xl flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <div>
            <p className="text-white font-semibold text-lg leading-tight">Yeni Ödev Oluştur</p>
            <p className="text-blue-200 text-sm mt-0.5">Öğrencilerinize yeni bir görev tanımlayın</p>
          </div>
        </div>
      </div>

      <form action={formAction}>
        <div className="p-6 space-y-5">

          {state?.error && (
            <div className="flex items-start gap-3 bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl px-4 py-3.5">
              <svg className="w-4 h-4 mt-0.5 shrink-0 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
              {state.error}
            </div>
          )}

          {/* Sınıf + Ders – 2 col grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">Sınıf</label>
              <select name="class_id" required className={field}>
                <option value="">Sınıf seçin</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">Ders</label>
              <input name="subject" type="text" required placeholder="Matematik" className={field} />
            </div>
          </div>

          {/* Başlık */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">Başlık</label>
            <input name="title" type="text" required placeholder="Ödev başlığını girin" className={field} />
          </div>

          {/* Açıklama */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Açıklama <span className="text-gray-400 font-normal normal-case tracking-normal">(opsiyonel)</span>
            </label>
            <textarea
              name="description"
              rows={3}
              placeholder="Ödev hakkında notlar veya açıklamalar..."
              className={`${field} resize-none`}
            />
          </div>

          {/* Son Teslim Tarihi */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">Son Teslim Tarihi</label>
            <input name="due_date" type="date" required className={field} />
          </div>

        </div>

        {/* Actions */}
        <div className="px-6 py-4 bg-gray-50/70 border-t border-gray-100 flex flex-col-reverse sm:flex-row gap-3">
          <Link
            href="/odevler"
            className="flex-1 text-center px-5 py-3 border border-gray-200 bg-white rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-all duration-200"
          >
            İptal
          </Link>
          <button
            type="submit"
            disabled={isPending}
            className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-5 py-3 rounded-xl text-sm font-semibold shadow-lg shadow-blue-500/30 hover:shadow-blue-500/40 disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200"
          >
            {isPending ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Oluşturuluyor...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Ödev Oluştur
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
