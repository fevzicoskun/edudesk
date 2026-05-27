'use client'

import { useState, useEffect } from 'react'
import { useActionState }      from 'react'
import { useRouter }           from 'next/navigation'
import { createSokReportAction } from '@/app/actions/inspection'
import { DEFAULT_AGENDA_ITEMS, DEFAULT_DECISIONS } from '@/src/domains/inspection/types'
import type { AgendaItem, Participant } from '@/src/domains/inspection/types'

interface Props {
  classes:      { id: string; name: string; grade: number }[]
  teachers:     { id: string; full_name: string; subject: string | null }[]
  currentTerm:  1 | 2
  academicYear: string
}

export default function SokForm({ classes, teachers, currentTerm, academicYear }: Props) {
  const [state, action, pending] = useActionState(createSokReportAction, null)
  const router = useRouter()

  const [agendaItems, setAgendaItems] = useState<AgendaItem[]>(
    DEFAULT_AGENDA_ITEMS.map(item => ({ ...item, discussed: false, note: '' }))
  )
  const [selectedTeachers, setSelectedTeachers] = useState<Participant[]>([])

  useEffect(() => {
    if (state && 'id' in state && state.id) router.push('/profil/dosyam/sok')
  }, [state, router])

  const toggleDiscussed = (order: number) =>
    setAgendaItems(prev => prev.map(item =>
      item.order === order ? { ...item, discussed: !item.discussed } : item
    ))

  const setAgendaNote = (order: number, note: string) =>
    setAgendaItems(prev => prev.map(item =>
      item.order === order ? { ...item, note } : item
    ))

  const toggleTeacher = (t: { id: string; full_name: string; subject: string | null }) =>
    setSelectedTeachers(prev => {
      const exists = prev.some(p => p.user_id === t.id)
      return exists
        ? prev.filter(p => p.user_id !== t.id)
        : [...prev, { user_id: t.id, full_name: t.full_name, subject: t.subject ?? '' }]
    })

  const defaultDecisions = DEFAULT_DECISIONS.map(d => ({ ...d, note: '' }))

  return (
    <form action={action} className="flex flex-col gap-5 max-w-2xl">
      <h1 className="text-lg font-bold">Yeni ŞÖK Tutanağı</h1>

      {state?.error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">
          {state.error}
        </div>
      )}

      <input type="hidden" name="participants"  value={JSON.stringify(selectedTeachers)} />
      <input type="hidden" name="agenda_items"  value={JSON.stringify(agendaItems)} />
      <input type="hidden" name="decisions"     value={JSON.stringify(defaultDecisions)} />
      <input type="hidden" name="academic_year" value={academicYear} />

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="text-xs font-semibold text-gray-700">Şube *</label>
          <select name="class_id" required
            className="w-full mt-1 border border-gray-300 rounded-lg px-2 py-1.5 text-sm">
            <option value="">Seç...</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-700">Toplantı Tarihi *</label>
          <input type="date" name="meeting_date" required
            defaultValue={new Date().toISOString().split('T')[0]}
            className="w-full mt-1 border border-gray-300 rounded-lg px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-700">Dönem *</label>
          <select name="term" required defaultValue={String(currentTerm)}
            className="w-full mt-1 border border-gray-300 rounded-lg px-2 py-1.5 text-sm">
            <option value="1">1. Dönem</option>
            <option value="2">2. Dönem</option>
          </select>
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold text-gray-700 block mb-1">Katılımcı Öğretmenler</label>
        <div className="flex flex-wrap gap-2 border border-gray-200 rounded-lg p-2">
          {teachers.map(t => {
            const selected = selectedTeachers.some(p => p.user_id === t.id)
            return (
              <button key={t.id} type="button" onClick={() => toggleTeacher(t)}
                className={`text-xs rounded-full px-2 py-1 border transition-colors ${
                  selected
                    ? 'bg-blue-100 border-blue-300 text-blue-800'
                    : 'bg-gray-50 border-gray-200 text-gray-600'
                }`}>
                {t.full_name}{t.subject ? ` (${t.subject})` : ''}{selected ? ' ✓' : ''}
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold text-gray-700 block mb-2">Gündem Maddeleri</label>
        <div className="flex flex-col gap-1.5">
          {agendaItems.map(item => (
            <div key={item.order}
              className={`border rounded-lg p-2.5 ${
                item.discussed ? 'border-emerald-200 bg-emerald-50' : 'border-gray-200'
              }`}>
              <div className="flex items-start gap-2">
                <button type="button" onClick={() => toggleDiscussed(item.order)}
                  className={`w-4 h-4 mt-0.5 rounded flex-shrink-0 border flex items-center justify-center text-xs ${
                    item.discussed
                      ? 'bg-emerald-500 border-emerald-500 text-white'
                      : 'border-gray-300'
                  }`}>
                  {item.discussed ? '✓' : ''}
                </button>
                <span className={`text-xs flex-1 ${item.discussed ? 'text-emerald-800 font-medium' : 'text-gray-600'}`}>
                  {item.order}. {item.text}
                </span>
              </div>
              {item.discussed && (
                <input type="text" placeholder="Not ekle... (opsiyonel)"
                  value={item.note}
                  onChange={e => setAgendaNote(item.order, e.target.value)}
                  className="w-full mt-1.5 ml-6 text-xs border border-emerald-200 rounded px-2 py-1" />
              )}
            </div>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold text-gray-700 block mb-2">Alınan Kararlar</label>
        <div className="flex flex-col gap-1 border border-gray-200 rounded-lg overflow-hidden">
          {defaultDecisions.map(d => (
            <div key={d.order} className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 last:border-0">
              <span className="text-xs text-gray-400 w-4">{d.order}.</span>
              <span className="text-xs text-gray-700 flex-1">{d.text}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <button type="submit" disabled={pending}
          className="bg-blue-600 text-white text-sm rounded-lg px-4 py-2 disabled:opacity-50">
          {pending ? 'Kaydediliyor...' : '💾 Tutanağı Kaydet'}
        </button>
        <a href="/profil/dosyam/sok" className="bg-gray-100 text-gray-700 text-sm rounded-lg px-4 py-2">
          İptal
        </a>
      </div>
    </form>
  )
}
