'use client'

import { useState, useTransition } from 'react'
import { useToast } from '@/components/Toast'
import { sendHomeworkReminderEmails } from '@/app/actions/veli-bildirim'
import type { SubmissionStatus } from '@/src/shared/types'

type VeliItem = {
  student_id: string
  full_name: string
  student_number: string | null
  status: SubmissionStatus
  veli_telefon: string | null
  veli_ad: string | null
  veli_email: string | null
}

type FilterType = 'yapilmadi' | 'eksik' | 'gec' | 'tum'

const FILTER_LABELS: Record<FilterType, string> = {
  yapilmadi: 'Yapılmadı',
  eksik:     'Eksik',
  gec:       'Geç',
  tum:       'Tümü',
}

const MISSING_STATUSES: SubmissionStatus[] = ['yapilmadi', 'eksik', 'gec']

function waLink(telefon: string): string {
  const digits = telefon.replace(/\D/g, '')
  if (digits.startsWith('90')) return `https://wa.me/${digits}`
  if (digits.startsWith('0'))  return `https://wa.me/9${digits}`
  if (digits.startsWith('5'))  return `https://wa.me/90${digits}`
  return `https://wa.me/${digits}`
}

function waMessage(ogrenciAdi: string, odevAdi: string, teslimTarihi: string, veliAdi: string | null): string {
  const hitap = veliAdi ? `Sayın ${veliAdi},` : 'Sayın veli,'
  const msg = `${hitap}\n\n${ogrenciAdi} adlı öğrencinizin "${odevAdi}" ödevi ${teslimTarihi} tarihinde teslim edilmesi gerekmektedir.\n\nLütfen ödevin tamamlandığından emin olunuz.\n\nSaygılarımla.`
  return encodeURIComponent(msg)
}

export default function VeliIletisimPaneli({
  homeworkId,
  homeworkTitle,
  dueDate,
  items,
}: {
  homeworkId: string
  homeworkTitle: string
  dueDate: string
  items: VeliItem[]
}) {
  const [filter, setFilter]          = useState<FilterType>('yapilmadi')
  const [isPending, startTransition] = useTransition()
  const { toast }                    = useToast()

  const filtered = items.filter(i => {
    if (filter === 'tum') return MISSING_STATUSES.includes(i.status)
    return i.status === filter
  })

  const withEmail = filtered.filter(i => i.veli_email)

  function sendEmails() {
    if (withEmail.length === 0) { toast('E-posta adresi kayıtlı veli yok', 'error'); return }
    startTransition(async () => {
      const result = await sendHomeworkReminderEmails(
        homeworkId,
        withEmail.map(i => i.student_id)
      )
      if (result.error) { toast(result.error, 'error'); return }
      toast(`${result.sent} veliye e-posta gönderildi`, 'success')
    })
  }

  const missingTotal = items.filter(i => MISSING_STATUSES.includes(i.status)).length

  if (missingTotal === 0) {
    return (
      <div className="mt-8 print:hidden">
        <p className="text-sm text-gray-500 dark:text-slate-400 text-center py-4">
          Teslim etmemiş öğrenci yok — veli bildirimi gerekmiyor.
        </p>
      </div>
    )
  }

  return (
    <div className="mt-8 print:hidden">
      <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100 mb-3">
        Ailelere Ulaş
      </h2>

      {/* Filtre butonları */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {(Object.keys(FILTER_LABELS) as FilterType[]).map(f => {
          const count = f === 'tum'
            ? missingTotal
            : items.filter(i => i.status === f).length
          if (f !== 'tum' && count === 0) return null
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                filter === f
                  ? 'bg-gray-800 dark:bg-slate-200 text-white dark:text-slate-900 border-transparent'
                  : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-400 border-gray-200 dark:border-slate-700 hover:border-gray-300'
              }`}
            >
              {FILTER_LABELS[f]} ({count})
            </button>
          )
        })}
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-slate-400 py-2">Bu filtreye uyan öğrenci yok.</p>
      ) : (
        <>
          {withEmail.length > 0 && (
            <button
              onClick={sendEmails}
              disabled={isPending}
              className="mb-3 flex items-center gap-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-2.5 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPending ? (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              )}
              {withEmail.length} veliye e-posta gönder
            </button>
          )}

          <div className="flex flex-col gap-2">
            {filtered.map(o => (
              <div
                key={o.student_id}
                className="flex items-center justify-between bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-3 gap-3 min-h-[56px]"
              >
                <span className="text-sm text-gray-800 dark:text-slate-200 truncate min-w-0">
                  {o.student_number ? `${o.student_number} — ` : ''}{o.full_name}
                  {o.veli_ad && (
                    <span className="text-xs text-gray-500 dark:text-slate-400 ml-1.5">({o.veli_ad})</span>
                  )}
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  {o.veli_email && (
                    <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium">✉</span>
                  )}
                  {o.veli_telefon && (
                    <a
                      href={`${waLink(o.veli_telefon)}?text=${waMessage(o.full_name, homeworkTitle, dueDate, o.veli_ad)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs font-medium text-white bg-green-500 hover:bg-green-600 active:bg-green-700 rounded-lg px-3 py-2 transition-colors"
                    >
                      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                      </svg>
                      WA
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
