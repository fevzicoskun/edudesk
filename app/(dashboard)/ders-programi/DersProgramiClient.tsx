'use client'

import { useRef, useState, useTransition } from 'react'
import { saveSchedule, ocrSchedule } from '@/app/actions/schedule'
import type { Period, Slot } from '@/src/domains/schedule/scheduleMath'

const DAYS = [
  { n: 1, label: 'Pazartesi' },
  { n: 2, label: 'Salı' },
  { n: 3, label: 'Çarşamba' },
  { n: 4, label: 'Perşembe' },
  { n: 5, label: 'Cuma' },
]

type Props = {
  initialPeriods: Period[]
  initialSlots: Slot[]
  classes: { id: string; name: string }[]
  subject: string
}

export default function DersProgramiClient({ initialPeriods, initialSlots, classes, subject }: Props) {
  const [periods, setPeriods] = useState<Period[]>(initialPeriods)
  const [slots, setSlots] = useState<Slot[]>(initialSlots)
  const [editTimes, setEditTimes] = useState(false)
  const [msg, setMsg] = useState<{ ok?: boolean; text: string } | null>(null)
  const [pending, startTransition] = useTransition()

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

  const fileRef = useRef<HTMLInputElement>(null)

  function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // aynı dosya tekrar seçilebilsin
    if (!file) return
    setMsg(null)
    const fd = new FormData()
    fd.append('image', file)
    startTransition(async () => {
      const res = await ocrSchedule(fd)
      if (res.error) { setMsg({ text: res.error }); return }
      const found = res.slots ?? []
      setSlots(found)
      setMsg({ ok: true, text: `${found.length} ders bulundu. Lütfen kontrol edip kaydedin.` })
    })
  }

  function save() {
    setMsg(null)
    startTransition(async () => {
      const res = await saveSchedule({ periods, slots })
      setMsg(res.error ? { text: res.error } : { ok: true, text: 'Kaydedildi' })
    })
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">Ders Programım</h1>
          {subject && <p className="text-sm text-gray-500 dark:text-slate-400">{subject}</p>}
        </div>
        <div className="flex items-center gap-2">
          <input ref={fileRef} type="file" accept="image/*" onChange={onPickImage} className="hidden" />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={pending || classes.length === 0}
            className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 dark:border-slate-600 text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 disabled:opacity-50"
          >
            {pending ? 'Okunuyor…' : 'Fotoğraftan doldur'}
          </button>
          <button
            onClick={() => setEditTimes(v => !v)}
            className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 dark:border-slate-600 text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800"
          >
            {editTimes ? 'Saatleri gizle' : 'Zil saatlerini düzenle'}
          </button>
          <button
            onClick={save}
            disabled={pending}
            className="text-sm px-4 py-1.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {pending ? 'Kaydediliyor…' : 'Kaydet'}
          </button>
        </div>
      </div>

      {msg && (
        <p className={`mb-3 text-sm ${msg.ok ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
          {msg.text}
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="p-2 text-left text-gray-500 dark:text-slate-400 font-medium w-28">Ders</th>
              {DAYS.map(d => (
                <th key={d.n} className="p-2 text-left text-gray-700 dark:text-slate-200 font-semibold min-w-[120px]">{d.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {periods.map(p => (
              <tr key={p.no} className="border-t border-gray-100 dark:border-slate-800">
                <td className="p-2 align-top">
                  <div className="font-semibold text-gray-800 dark:text-slate-200">{p.no}. ders</div>
                  {editTimes ? (
                    <div className="flex items-center gap-1 mt-1">
                      <input type="time" value={p.start} onChange={e => setPeriodTime(p.no, 'start', e.target.value)}
                        className="w-[72px] text-xs border rounded px-1 py-0.5 dark:bg-slate-800 dark:border-slate-600" />
                      <span className="text-gray-400">–</span>
                      <input type="time" value={p.end} onChange={e => setPeriodTime(p.no, 'end', e.target.value)}
                        className="w-[72px] text-xs border rounded px-1 py-0.5 dark:bg-slate-800 dark:border-slate-600" />
                    </div>
                  ) : (
                    <div className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{p.start}–{p.end}</div>
                  )}
                </td>
                {DAYS.map(d => (
                  <td key={d.n} className="p-1 align-top">
                    <select
                      value={cellClass(d.n, p.no)}
                      onChange={e => setCell(d.n, p.no, e.target.value)}
                      className="w-full text-sm border border-gray-200 dark:border-slate-700 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-900 text-gray-800 dark:text-slate-200"
                    >
                      <option value="">—</option>
                      {classes.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </td>
                ))}
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
