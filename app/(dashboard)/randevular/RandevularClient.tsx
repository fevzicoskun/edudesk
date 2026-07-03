'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Period, Slot } from '@/src/domains/schedule/scheduleMath'
import type { Meeting, StudentOption } from '@/src/domains/meetings/services/MeetingService'
import type { MeetingStatus } from '@/src/domains/meetings/parentMeetingMath'
import { freePeriods, weekdayFromDate } from '@/src/domains/meetings/parentMeetingMath'
import { createMeeting, setMeetingStatus, deleteMeeting } from '@/app/actions/meetings'
import { todayLocalISO } from '@/src/shared/date'

const STATUS_LABEL: Record<MeetingStatus, string> = {
  planlandi: 'Planlandı',
  yapildi: 'Yapıldı',
  iptal: 'İptal',
}
const STATUS_BADGE: Record<MeetingStatus, string> = {
  planlandi: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  yapildi: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  iptal: 'bg-gray-100 text-gray-500 dark:bg-slate-800 dark:text-slate-400',
}

const fmtDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('tr-TR', {
    day: 'numeric', month: 'long', weekday: 'short', timeZone: 'UTC',
  })

export default function RandevularClient({
  periods, slots, meetings, students,
}: {
  periods: Period[]
  slots: Slot[]
  meetings: Meeting[]
  students: StudentOption[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  // Form state
  const [date, setDate] = useState('')
  const [period, setPeriod] = useState<number | ''>('')
  const [studentId, setStudentId] = useState('')
  const [note, setNote] = useState('')

  const periodLabel = (no: number) => {
    const p = periods.find(x => x.no === no)
    return p ? `${no}. ders · ${p.start}–${p.end}` : `${no}. ders`
  }

  // Seçilen tarihe zaten rezerve periyotlar (iptal hariç).
  const bookedPeriods = useMemo(
    () => meetings.filter(m => m.meet_date === date && m.status !== 'iptal').map(m => m.period),
    [meetings, date],
  )
  const available = useMemo(() => {
    if (!date) return []
    return freePeriods(slots, periods, weekdayFromDate(date), bookedPeriods)
  }, [date, slots, periods, bookedPeriods])

  // toISOString UTC döner; TR gece 00–03 arası "bugün" kayar → Europe/Istanbul helper'ı.
  const today = useMemo(() => todayLocalISO(), [])
  const upcoming = useMemo(() => meetings.filter(m => m.meet_date >= today && m.status !== 'iptal'), [meetings, today])
  const past = useMemo(() => meetings.filter(m => m.meet_date < today || m.status === 'iptal'), [meetings, today])

  function resetForm() {
    setDate(''); setPeriod(''); setStudentId(''); setNote(''); setErr(null)
  }

  async function submit() {
    setErr(null)
    if (!date || period === '' || !studentId) {
      setErr('Tarih, saat ve öğrenci zorunlu')
      return
    }
    setBusy(true)
    const res = await createMeeting({ studentId, meetDate: date, period: Number(period), note: note || null })
    setBusy(false)
    if (res.error) { setErr(res.error); return }
    setOpen(false); resetForm(); router.refresh()
  }

  async function changeStatus(id: string, status: MeetingStatus) {
    setErr(null)
    const res = await setMeetingStatus({ id, status })
    if (res.error) { setErr(res.error); return }
    router.refresh()
  }

  async function remove(id: string) {
    setErr(null)
    const res = await deleteMeeting(id)
    if (res.error) { setErr(res.error); return }
    router.refresh()
  }

  const renderRow = (m: Meeting) => (
    <li key={m.id} className="flex flex-wrap items-center gap-2 py-3 border-b border-gray-100 dark:border-slate-800">
      <span className="font-medium">{m.student_name}</span>
      {m.class_name && <span className="text-sm text-gray-500 dark:text-slate-400">{m.class_name}</span>}
      <span className="text-sm text-gray-600 dark:text-slate-300">· {fmtDate(m.meet_date)} · {periodLabel(m.period)}</span>
      <span className={`ml-auto text-xs px-2 py-0.5 rounded ${STATUS_BADGE[m.status]}`}>{STATUS_LABEL[m.status]}</span>
      {m.note && <p className="w-full text-sm text-gray-500 dark:text-slate-400">{m.note}</p>}
      <div className="w-full flex gap-3 text-sm">
        {m.status === 'planlandi' && (
          <>
            <button onClick={() => changeStatus(m.id, 'yapildi')} className="text-green-600 hover:underline">Yapıldı</button>
            <button onClick={() => changeStatus(m.id, 'iptal')} className="text-gray-500 dark:text-slate-400 hover:underline">İptal</button>
          </>
        )}
        <button onClick={() => remove(m.id)} className="text-red-600 hover:underline">Sil</button>
      </div>
    </li>
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Veli Görüşmeleri</h1>
        <button
          onClick={() => { resetForm(); setOpen(true) }}
          className="px-3 py-2 rounded bg-blue-600 text-white text-sm hover:bg-blue-700"
        >
          Yeni Randevu
        </button>
      </div>

      {err && !open && <p className="mb-3 text-sm text-red-600">{err}</p>}

      <section className="mb-8">
        <h2 className="text-sm font-semibold text-gray-500 dark:text-slate-400 mb-2">Yaklaşan</h2>
        {upcoming.length === 0
          ? <p className="text-sm text-gray-500 dark:text-slate-400">Yaklaşan randevun yok.</p>
          : <ul>{upcoming.map(renderRow)}</ul>}
      </section>

      <section>
        <h2 className="text-sm font-semibold text-gray-500 dark:text-slate-400 mb-2">Geçmiş</h2>
        {past.length === 0
          ? <p className="text-sm text-gray-500 dark:text-slate-400">Geçmiş randevu yok.</p>
          : <ul>{past.map(renderRow)}</ul>}
      </section>

      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={() => setOpen(false)}>
          <div className="bg-white dark:bg-slate-900 rounded-lg p-5 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-4">Yeni Randevu</h2>

            <label className="block text-sm mb-1" htmlFor="randevu-tarih">Tarih</label>
            <input
              id="randevu-tarih"
              type="date" value={date} min={today}
              onChange={e => { setDate(e.target.value); setPeriod('') }}
              className="w-full mb-3 border rounded px-2 py-1.5 dark:bg-slate-800 dark:border-slate-700"
            />

            <label className="block text-sm mb-1" htmlFor="randevu-saat">Saat</label>
            {date && available.length === 0
              ? <p className="mb-3 text-sm text-amber-600">Bu gün boş saatin yok.</p>
              : (
                <select
                  id="randevu-saat"
                  value={period} disabled={!date}
                  onChange={e => setPeriod(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full mb-3 border rounded px-2 py-1.5 dark:bg-slate-800 dark:border-slate-700"
                >
                  <option value="">{date ? 'Saat seç' : 'Önce tarih seç'}</option>
                  {available.map(p => <option key={p.no} value={p.no}>{periodLabel(p.no)}</option>)}
                </select>
              )}

            <label className="block text-sm mb-1" htmlFor="randevu-ogrenci">Öğrenci</label>
            <select
              id="randevu-ogrenci"
              value={studentId} onChange={e => setStudentId(e.target.value)}
              className="w-full mb-3 border rounded px-2 py-1.5 dark:bg-slate-800 dark:border-slate-700"
            >
              <option value="">Öğrenci seç</option>
              {students.map(s => (
                <option key={s.id} value={s.id}>{s.full_name}{s.class_name ? ` (${s.class_name})` : ''}</option>
              ))}
            </select>

            <label className="block text-sm mb-1" htmlFor="randevu-not">Not (opsiyonel)</label>
            <textarea
              id="randevu-not"
              value={note} onChange={e => setNote(e.target.value)} rows={2} maxLength={1000}
              className="w-full mb-3 border rounded px-2 py-1.5 dark:bg-slate-800 dark:border-slate-700"
            />

            {err && <p className="mb-3 text-sm text-red-600" role="alert">{err}</p>}

            <div className="flex justify-end gap-3">
              <button onClick={() => setOpen(false)} className="px-3 py-2 text-sm text-gray-600 dark:text-slate-300">Vazgeç</button>
              <button onClick={submit} disabled={busy} className="px-3 py-2 rounded bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-50">
                {busy ? 'Kaydediliyor…' : 'Kaydet'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
