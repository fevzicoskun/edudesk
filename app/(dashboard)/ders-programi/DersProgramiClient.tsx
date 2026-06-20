'use client'

import { useMemo, useRef, useState, useTransition } from 'react'
import { saveSchedule } from '@/app/actions/schedule'
import { parseSchedulePdf, extractPageTitle, findTeacherPageIndex, type PdfTextItem } from '@/src/domains/schedule/parseSchedulePdf'
import type { Period, Slot } from '@/src/domains/schedule/scheduleMath'
import { classColor } from '@/src/domains/schedule/classColor'

const DAYS = [
  { n: 1, label: 'Pazartesi', short: 'Pzt' },
  { n: 2, label: 'Salı', short: 'Sal' },
  { n: 3, label: 'Çarşamba', short: 'Çar' },
  { n: 4, label: 'Perşembe', short: 'Per' },
  { n: 5, label: 'Cuma', short: 'Cum' },
]

type Props = {
  initialPeriods: Period[]
  initialSlots: Slot[]
  classes: { id: string; name: string }[]
  subject: string
  teacherName: string
}

export default function DersProgramiClient({ initialPeriods, initialSlots, classes, subject, teacherName }: Props) {
  const [periods, setPeriods] = useState<Period[]>(initialPeriods)
  const [slots, setSlots] = useState<Slot[]>(initialSlots)
  const [editing, setEditing] = useState(false)
  const [msg, setMsg] = useState<{ ok?: boolean; text: string } | null>(null)
  const [pending, startTransition] = useTransition()
  const [importing, setImporting] = useState(false)
  // İsim otomatik eşleşmezse: kullanıcıya sayfa seçtirmek için tüm sayfaların verisi + başlıkları
  const [pageChoices, setPageChoices] = useState<{ pages: PdfTextItem[][]; titles: string[] } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const classNameById = useMemo(() => new Map(classes.map(c => [c.id, c.name])), [classes])
  const todayN = new Date().getDay() // 0=Paz … 6=Cmt; DAYS.n 1..5 ile eşleşir

  function applyPage(items: PdfTextItem[], title: string) {
    const found = parseSchedulePdf(items, classes)
    if (found.length === 0) {
      setMsg({ text: `${title || 'Sayfa'}: ders bulunamadı (farklı sayfa ya da taranmış görüntü olabilir). Izgarayı elle doldurabilirsiniz.` })
      return
    }
    setSlots(found)
    setPageChoices(null)
    setEditing(true) // kullanıcı içe aktarılanı kontrol edip kaydetsin
    setMsg({ ok: true, text: `${title} — ${found.length} ders saati bulundu. Kontrol edip kaydedin.` })
  }

  async function onPickPdf(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // aynı dosya tekrar seçilebilsin
    if (!file) return
    setMsg(null)
    setPageChoices(null)
    setImporting(true)
    try {
      // pdfjs yalnız bu butona basınca yüklenir — uygulama bundle'ını şişirmez
      const pdfjs = await import('pdfjs-dist')
      // v6'da worker zorunlu; worker public/'ten same-origin yüklenir (bundler'dan bağımsız)
      // ponytail: pdfjs sürümü güncellenirse public/pdf.worker.min.mjs'i de yenile
      pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
      const data = new Uint8Array(await file.arrayBuffer())
      const doc = await pdfjs.getDocument({ data }).promise
      // Her sayfanın metin koordinatlarını çıkar (tüm-okul PDF'inde her öğretmen 1 sayfa)
      const pages: PdfTextItem[][] = []
      for (let i = 1; i <= doc.numPages; i++) {
        const tc = await (await doc.getPage(i)).getTextContent()
        pages.push(
          tc.items
            .filter((it): it is typeof it & { str: string; transform: number[]; width: number } => 'str' in it)
            .map(it => ({ str: it.str, x: it.transform[4], y: it.transform[5], width: it.width })),
        )
      }
      const titles = pages.map(extractPageTitle)
      const idx = findTeacherPageIndex(titles, teacherName)
      if (idx >= 0) {
        applyPage(pages[idx], titles[idx])
      } else {
        // Otomatik eşleşmedi → kullanıcı kendi sayfasını seçsin
        setPageChoices({ pages, titles })
        setMsg({ text: `Adın ("${teacherName}") PDF'te otomatik bulunamadı. Aşağıdan kendi sayfanı seç:` })
      }
    } catch (err) {
      console.error('PDF okuma hatası:', err)
      setMsg({ text: 'PDF okunamadı, ızgarayı elle doldurabilirsiniz.' })
    } finally {
      setImporting(false)
    }
  }

  const cellClass = (day: number, period: number) =>
    slots.find(s => s.day === day && s.period === period)?.class_id ?? ''

  function setCell(day: number, period: number, classId: string) {
    setSlots(prev => {
      const rest = prev.filter(s => !(s.day === day && s.period === period))
      return classId ? [...rest, { day, period, class_id: classId }] : rest
    })
  }

  function setPeriodTime(no: number, field: 'start' | 'end', value: string) {
    setPeriods(prev => prev.map(p => (p.no === no ? { ...p, [field]: value } : p)))
  }

  function save() {
    setMsg(null)
    startTransition(async () => {
      const res = await saveSchedule({ periods, slots })
      if (res.error) {
        setMsg({ text: res.error })
      } else {
        setMsg({ ok: true, text: 'Ders programın kaydedildi.' })
        setEditing(false)
      }
    })
  }

  const btnOutline =
    'text-sm px-3 py-1.5 rounded-lg border border-gray-300 dark:border-slate-600 text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 disabled:opacity-50 transition-colors'
  const btnPrimary =
    'text-sm px-4 py-1.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors'

  return (
    <div>
      {/* Başlık + eylemler */}
      <div className="flex items-start justify-between gap-3 flex-wrap mb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-slate-100">Ders Programım</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
            {subject && <span>{subject}</span>}
            {subject && <span className="mx-1.5 text-gray-300 dark:text-slate-600">·</span>}
            {slots.length > 0 ? `haftada ${slots.length} ders saati` : 'henüz ders eklenmedi'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input ref={fileRef} type="file" accept="application/pdf,.pdf" onChange={onPickPdf} className="hidden" aria-hidden="true" tabIndex={-1} />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={importing || pending || classes.length === 0}
            className={btnOutline}
          >
            {importing ? 'Okunuyor…' : 'PDF\'ten doldur'}
          </button>
          {editing ? (
            <>
              <button type="button" onClick={() => setEditing(false)} disabled={pending} className={btnOutline}>
                Görüntüle
              </button>
              <button type="button" onClick={save} disabled={pending} className={btnPrimary}>
                {pending ? 'Kaydediliyor…' : 'Kaydet'}
              </button>
            </>
          ) : (
            <button type="button" onClick={() => setEditing(true)} disabled={classes.length === 0} className={btnPrimary}>
              Düzenle
            </button>
          )}
        </div>
      </div>

      {msg && (
        <p
          className={`mb-4 text-sm rounded-lg px-3 py-2 ${
            msg.ok
              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
              : 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300'
          }`}
        >
          {msg.text}
        </p>
      )}

      {pageChoices && (
        <div className="mb-4 flex flex-wrap gap-2">
          {pageChoices.titles.map((t, i) =>
            t ? (
              <button
                key={i}
                type="button"
                onClick={() => applyPage(pageChoices.pages[i], t)}
                className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors"
              >
                {t}
              </button>
            ) : null,
          )}
        </div>
      )}

      {/* Çizelge */}
      <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-50/80 dark:bg-slate-800/40">
              <th className="px-3 py-3 text-left text-[11px] font-medium uppercase tracking-wide text-gray-400 dark:text-slate-500 w-24 border-b border-gray-200 dark:border-slate-800">
                Saat
              </th>
              {DAYS.map(d => {
                const isToday = d.n === todayN
                return (
                  <th
                    key={d.n}
                    className={`px-3 py-3 text-center font-semibold border-b border-l border-gray-200 dark:border-slate-800 min-w-[120px] ${
                      isToday ? 'text-blue-700 dark:text-blue-300' : 'text-gray-700 dark:text-slate-200'
                    }`}
                  >
                    <span className="hidden sm:inline">{d.label}</span>
                    <span className="sm:hidden">{d.short}</span>
                    {isToday && (
                      <span className="ml-1.5 align-middle inline-block text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-600 text-white">
                        bugün
                      </span>
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {periods.map(p => (
              <tr key={p.no} className="border-t border-gray-100 dark:border-slate-800/70">
                {/* Saat rayı */}
                <td className="px-3 py-2 align-middle text-center bg-gray-50/50 dark:bg-slate-800/20 border-r border-gray-100 dark:border-slate-800">
                  <div className="text-base font-bold text-gray-700 dark:text-slate-300 leading-none">{p.no}</div>
                  {editing ? (
                    <div className="flex items-center justify-center gap-1 mt-1.5">
                      <input
                        type="time"
                        value={p.start}
                        onChange={e => setPeriodTime(p.no, 'start', e.target.value)}
                        className="w-[68px] text-xs border rounded px-1 py-0.5 dark:bg-slate-800 dark:border-slate-600"
                      />
                      <span className="text-gray-400">–</span>
                      <input
                        type="time"
                        value={p.end}
                        onChange={e => setPeriodTime(p.no, 'end', e.target.value)}
                        className="w-[68px] text-xs border rounded px-1 py-0.5 dark:bg-slate-800 dark:border-slate-600"
                      />
                    </div>
                  ) : (
                    <div className="text-[11px] text-gray-400 dark:text-slate-500 mt-1 tabular-nums">
                      {p.start}–{p.end}
                    </div>
                  )}
                </td>

                {DAYS.map(d => {
                  const id = cellClass(d.n, p.no)
                  const isToday = d.n === todayN
                  return (
                    <td
                      key={d.n}
                      className={`px-1.5 py-1.5 align-middle border-l border-gray-100 dark:border-slate-800/70 ${
                        isToday && !editing ? 'bg-blue-50/40 dark:bg-blue-500/[0.04]' : ''
                      }`}
                    >
                      {editing ? (
                        <select
                          value={id}
                          onChange={e => setCell(d.n, p.no, e.target.value)}
                          aria-label={`${d.label} ${p.no}. ders`}
                          className="w-full text-sm border border-gray-200 dark:border-slate-700 rounded-lg px-2 py-2 bg-white dark:bg-slate-900 text-gray-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">—</option>
                          {classes.map(c => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      ) : id ? (
                        <div
                          className={`flex items-center justify-center min-h-[44px] rounded-lg px-2 py-1.5 text-center font-semibold ring-1 ${classColor(
                            classNameById.get(id) ?? id,
                          )}`}
                        >
                          {classNameById.get(id) ?? '—'}
                        </div>
                      ) : (
                        <div className="min-h-[44px]" aria-hidden="true" />
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {classes.length === 0 && (
        <p className="mt-4 text-sm text-gray-500 dark:text-slate-400">Okulda kayıtlı sınıf yok. Önce sınıf eklenmeli.</p>
      )}
    </div>
  )
}
