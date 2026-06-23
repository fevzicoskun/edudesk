'use client'

import { useActionState, useState, useEffect } from 'react'
import { createHomework } from '@/src/domains/homework/actions'
import Link from 'next/link'
import ClassWeekLoadSection from './ClassWeekLoadSection'

type ClassItem  = { id: string; name: string; grade: number }
type SourceItem = { id: string; name: string; subject: string | null }

export type Defaults = {
  title?: string
  subject?: string
  description?: string | null
  class_id?: string
  source_id?: string | null
  due_date?: string
  fromTemplate?: boolean
}

function todayISO() {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const field =
  'w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-base text-gray-900 placeholder:text-gray-400 hover:border-gray-300 focus:outline-none focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 transition-all duration-200'

export default function HomeworkForm({
  classes,
  sources,
  defaults,
}: {
  classes: ClassItem[]
  sources: SourceItem[]
  defaults?: Defaults
}) {
  const [state, formAction, isPending] = useActionState(createHomework, null)
  const [isTemplate, setIsTemplate] = useState(false)

  useEffect(() => {
    if (state?.error) {
      document.querySelector('[data-hw-error]')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [state?.error])
  const [selectedClasses, setSelectedClasses] = useState<string[]>(
    defaults?.class_id ? [defaults.class_id] : []
  )

  function toggleClass(id: string) {
    setSelectedClasses(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const submitLabel = isTemplate
    ? 'Şablon Kaydet'
    : selectedClasses.length === 0
      ? 'Sınıf Seçin'
      : selectedClasses.length === 1
        ? 'Ödev Oluştur'
        : `${selectedClasses.length} Sınıfa Ödev Oluştur`

  const submitDisabled = isPending || (!isTemplate && selectedClasses.length === 0)

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
            <p className="text-white font-semibold text-lg leading-tight">
              {defaults?.fromTemplate ? 'Şablondan Ödev Oluştur' : 'Yeni Ödev Oluştur'}
            </p>
            <p className="text-blue-200 text-sm mt-0.5">
              {defaults?.fromTemplate
                ? 'Tarihi belirleyin ve kaydedin'
                : defaults
                  ? 'Kopyadan yeni ödev oluşturun'
                  : 'Bir veya birden fazla sınıfa ödev tanımlayın'}
            </p>
          </div>
        </div>
      </div>

      <form action={formAction}>
        <div className="p-6 space-y-5">

          {state?.error && (
            <div data-hw-error className="flex items-start gap-3 bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl px-4 py-3.5">
              <svg className="w-4 h-4 mt-0.5 shrink-0 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
              {state.error}
            </div>
          )}

          {/* Sınıf seçimi */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Sınıf
                {!isTemplate && selectedClasses.length > 1 && (
                  <span className="ml-2 normal-case font-medium text-blue-600 tracking-normal">
                    {selectedClasses.length} sınıf seçildi
                  </span>
                )}
              </label>
            </div>

            {isTemplate ? (
              /* Template: tek sınıf seçimi */
              <select name="class_id" required className={field} defaultValue={defaults?.class_id ?? ''}>
                <option value="">Sınıf seçin</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            ) : (
              /* Normal ödev: çoklu sınıf toggle */
              <>
                {classes.length === 0 ? (
                  <p className="text-sm text-gray-400 px-1">Henüz sınıf eklenmemiş.</p>
                ) : (
                  <div className="flex flex-wrap gap-2 p-3 bg-gray-50 border border-gray-200 rounded-xl">
                    {classes.map((c) => {
                      const selected = selectedClasses.includes(c.id)
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => toggleClass(c.id)}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium border-2 transition-all duration-150 ${
                            selected
                              ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                              : 'bg-white text-gray-700 border-gray-200 hover:border-blue-400 hover:text-blue-700'
                          }`}
                        >
                          {c.name}
                        </button>
                      )
                    })}
                  </div>
                )}
                {/* Hidden inputs — form submit için */}
                {selectedClasses.map(id => (
                  <input key={id} type="hidden" name="class_id" value={id} />
                ))}
                {selectedClasses.length === 0 && (
                  <p className="text-xs text-gray-400 pt-0.5">Tıklayarak bir veya birden fazla sınıf seçin.</p>
                )}
              </>
            )}
          </div>

          {/* Son Teslim Tarihi + Haftalık Yük */}
          <ClassWeekLoadSection isTemplate={isTemplate} selectedClasses={selectedClasses} initialDueDate={defaults?.due_date} />

          {/* Ders */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">Ders</label>
            <input name="subject" type="text" required placeholder="Matematik" className={field} defaultValue={defaults?.subject ?? ''} />
          </div>

          {/* Kaynak */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Kaynak <span className="text-gray-400 font-normal normal-case tracking-normal">(opsiyonel)</span>
              </label>
              <Link
                href="/ayarlar#kaynaklar"
                className="text-[11px] text-blue-500 hover:text-blue-700 transition-colors"
              >
                Kaynaklarımı yönet →
              </Link>
            </div>
            {sources.length > 0 ? (
              <select name="source_id" className={field} defaultValue={defaults?.source_id ?? ''}>
                <option value="">Kaynak seçin</option>
                {sources.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}{s.subject ? ` (${s.subject})` : ''}
                  </option>
                ))}
              </select>
            ) : (
              <div className="flex items-center gap-2 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700">
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Henüz kaynak eklemediniz.{' '}
                <Link href="/ayarlar#kaynaklar" className="font-semibold underline underline-offset-2 hover:text-amber-900">
                  Ayarlardan ekle
                </Link>
              </div>
            )}
          </div>

          {/* Başlık */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">Başlık</label>
            <input name="title" type="text" required placeholder="Ödev başlığını girin" className={field} defaultValue={defaults?.title ?? ''} />
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
              defaultValue={defaults?.description ?? ''}
            />
          </div>

          {/* Şablon toggle — şablon olarak kaydedilince tarih gerekmez */}
          {!defaults?.fromTemplate && (
            <label className="flex items-center gap-3 cursor-pointer select-none group">
              <div className="relative">
                <input
                  type="checkbox"
                  name="is_template"
                  value="true"
                  checked={isTemplate}
                  onChange={e => setIsTemplate(e.target.checked)}
                  className="sr-only"
                />
                <div className={`w-10 h-6 rounded-full transition-colors ${isTemplate ? 'bg-blue-600' : 'bg-gray-200 dark:bg-slate-600'}`} />
                <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${isTemplate ? 'translate-x-4' : ''}`} />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-slate-300">Şablon olarak kaydet</p>
                <p className="text-xs text-gray-500 dark:text-slate-400">Ödev listesinde görünmez, tekrar kullanmak için şablonlardan seçilir</p>
              </div>
            </label>
          )}

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
            disabled={submitDisabled}
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
                {submitLabel}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}

