'use client'

import { useActionState, useState, useEffect } from 'react'
import { formGonder } from '@/src/shared/utils/formGonder'
import { createHomework } from '@/src/domains/homework/actions'
import Link from 'next/link'
import ClassWeekLoadSection from './ClassWeekLoadSection'
import { onerilenBaslik } from '@/src/domains/homework/homeworkMath'
import DersSecici from '../DersSecici'
import type { DersSecenekleri } from '@/src/domains/homework/dersSecimi'

type ClassItem  = { id: string; name: string; grade: number }
type SourceItem = { id: string; name: string; subject: string | null }

export type Defaults = {
  title?: string
  source_name?: string
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

// Flex satırında genişliği flex belirler; field'ın w-full'ü hesabı bozuyordu.
const fieldFlex = field.replace('w-full ', '')

export default function HomeworkForm({
  classes,
  sources,
  defaults,
  dersSecenekleri,
}: {
  classes: ClassItem[]
  sources: SourceItem[]
  defaults?: Defaults
  /** Öğretmenin verebileceği dersler (ders programı → branş → okul) */
  dersSecenekleri: DersSecenekleri
}) {
  const [state, formAction, isPending] = useActionState(createHomework, null)
  const [isTemplate, setIsTemplate] = useState(false)

  // Öğretmenin dili "hangi kitaptan hangi sayfalar" — başlık ondan türer.
  // Öğretmen başlığa elle dokunursa öneri devreden çıkar.
  const [kaynak, setKaynak]         = useState(defaults?.source_name ?? '')
  const [sayfa, setSayfa]           = useState('')
  const [baslik, setBaslik]         = useState(defaults?.title ?? '')
  const [baslikElle, setBaslikElle] = useState(!!defaults?.title)
  const gosterilenBaslik = baslikElle ? baslik : onerilenBaslik(kaynak, sayfa)

  useEffect(() => {
    if (state?.error) {
      document.querySelector('[data-hw-error]')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [state?.error])
  const [selectedClasses, setSelectedClasses] = useState<string[]>(
    defaults?.class_id ? [defaults.class_id] : []
  )

  // Ders ön seçimi en son seçilen sınıfa göre (o sınıfta tek ders veriyorsa)
  const [sonSinif, setSonSinif] = useState<string | null>(defaults?.class_id ?? null)

  function toggleClass(id: string) {
    const kalan = selectedClasses.includes(id) ? selectedClasses.filter(x => x !== id) : [...selectedClasses, id]
    setSelectedClasses(kalan)
    setSonSinif(kalan.at(-1) ?? null)
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
    <div className="rounded-2xl overflow-clip bg-white border border-gray-200 shadow-sm">

      {/* Şablondan / kopyadan oluşturmada bağlam satırı (sayfa başlığı zaten "Ödev Oluştur") */}
      {defaults && (
        <p className="px-6 pt-5 text-sm text-gray-600 dark:text-slate-400">
          {defaults.fromTemplate ? 'Şablondan oluşturuluyor — tarihi belirleyip kaydedin.' : 'Kopyadan yeni ödev oluşturuluyor.'}
        </p>
      )}

      <form onSubmit={formGonder(formAction)}>
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
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">
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
              <select name="class_id" required className={field} defaultValue={defaults?.class_id ?? ''} onChange={e => setSonSinif(e.target.value || null)}>
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
            <p className="block text-sm font-medium text-gray-700 dark:text-slate-300">Ders</p>
            <DersSecici secenek={dersSecenekleri} sinifId={sonSinif} baslangic={defaults?.subject} selectClassName={field} />
          </div>

          {/* Kaynak + Sayfa */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="hw-source" className="block text-sm font-medium text-gray-700 dark:text-slate-300">
                Kaynak <span className="text-gray-400 font-normal normal-case tracking-normal">(opsiyonel)</span>
              </label>
              <Link
                href="/ayarlar#kaynaklar"
                className="text-[11px] text-blue-500 hover:text-blue-700 transition-colors"
              >
                Kaynaklarımı yönet →
              </Link>
            </div>
            <div className="flex gap-2">
              <input
                id="hw-source"
                name="source_name"
                type="text"
                list="hw-kaynak-listesi"
                maxLength={100}
                value={kaynak}
                onChange={e => setKaynak(e.target.value)}
                placeholder="Kitap veya kaynak adı"
                className={`${fieldFlex} flex-1 min-w-0`}
              />
              <input
                id="hw-sayfa"
                type="text"
                maxLength={30}
                value={sayfa}
                onChange={e => setSayfa(e.target.value)}
                placeholder="39-47"
                aria-label="Sayfa aralığı"
                className={`${fieldFlex} w-24 shrink-0`}
              />
            </div>
            <datalist id="hw-kaynak-listesi">
              {sources.map(s => (
                <option key={s.id} value={s.name}>{s.subject ?? ''}</option>
              ))}
            </datalist>
            <p className="text-xs text-gray-500 dark:text-slate-400 pt-0.5">
              Listede yoksa yazmanız yeter — kaynaklarınıza eklenir.
            </p>
          </div>

          {/* Başlık */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">Başlık</label>
            <input
              name="title"
              type="text"
              maxLength={200}
              required
              placeholder="Ödev başlığını girin"
              className={field}
              value={gosterilenBaslik}
              onChange={e => { setBaslikElle(true); setBaslik(e.target.value) }}
            />
          </div>

          {/* Açıklama */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">
              Açıklama <span className="text-gray-400 font-normal normal-case tracking-normal">(opsiyonel)</span>
            </label>
            <textarea
              name="description"
              rows={3}
              maxLength={2000}
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
        {/* Telefonda uzun formda düğme hep görünsün; masaüstünde normal akış */}
        <div className="sticky bottom-0 z-10 sm:static px-6 py-4 bg-gray-50 sm:bg-gray-50/70 border-t border-gray-100 flex flex-row gap-3">
          <Link
            href="/odevler"
            className="hidden sm:block flex-1 text-center px-5 py-3 border border-gray-200 bg-white rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-all duration-200"
          >
            İptal
          </Link>
          <button
            type="submit"
            disabled={submitDisabled}
            className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-xl text-sm font-semibold shadow-sm disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200"
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

