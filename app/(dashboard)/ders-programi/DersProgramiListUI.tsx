'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { deleteSchedule, renameOkulTypeLabel } from '@/app/actions/schedules'
import { useRouter } from 'next/navigation'

type Slot = { day: number; period: number; subject: string }
type Schedule = {
  id: string
  schedule_type: 'resmi' | 'okul'
  type_label: string
  teacher_id: string | null
  class_id: string | null
  title: string | null
  period_count: number
  slots: Slot[]
  created_at: string
  teacher: { full_name: string | null; subject: string | null } | null
  cls: { name: string; grade: number } | null
}
type Teacher = { id: string; full_name: string | null; subject: string | null }
type Cls = { id: string; name: string; grade: number }

export default function DersProgramiListUI({
  schedules,
  teachers,
  classes,
  okulLabel,
}: {
  schedules: Schedule[]
  teachers: Teacher[]
  classes: Cls[]
  okulLabel: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [editingLabel, setEditingLabel] = useState(false)
  const [labelValue, setLabelValue] = useState(okulLabel)
  const [savingLabel, setSavingLabel] = useState(false)
  const [filter, setFilter] = useState<'all' | 'ogretmen' | 'sinif'>('all')

  const filtered = schedules.filter(s => {
    if (filter === 'ogretmen') return s.teacher_id !== null
    if (filter === 'sinif') return s.class_id !== null
    return true
  })

  const resmi = filtered.filter(s => s.schedule_type === 'resmi')
  const okul = filtered.filter(s => s.schedule_type === 'okul')

  async function handleDelete(id: string) {
    if (!confirm('Bu programı silmek istediğinize emin misiniz?')) return
    setDeletingId(id)
    startTransition(async () => {
      await deleteSchedule(id)
      setDeletingId(null)
      router.refresh()
    })
  }

  async function handleSaveLabel() {
    if (!labelValue.trim()) return
    setSavingLabel(true)
    await renameOkulTypeLabel(labelValue.trim())
    setSavingLabel(false)
    setEditingLabel(false)
    router.refresh()
  }

  function scheduleName(s: Schedule) {
    if (s.teacher) return s.teacher.full_name ?? 'İsimsiz Öğretmen'
    if (s.cls) return `${s.cls.grade}. Sınıf — ${s.cls.name}`
    return s.title ?? 'Program'
  }

  function scheduleSubtitle(s: Schedule) {
    if (s.teacher) return s.teacher.subject ?? ''
    return ''
  }

  return (
    <div className="space-y-6">
      {/* Filter tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-slate-800 p-1 rounded-xl w-fit">
        {(['all', 'ogretmen', 'sinif'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === f
                ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 shadow-sm'
                : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-100'
            }`}
          >
            {f === 'all' ? 'Tümü' : f === 'ogretmen' ? 'Öğretmen Bazında' : 'Sınıf Bazında'}
          </button>
        ))}
      </div>

      {/* Resmi Ders Programı section */}
      <section>
        <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
          Resmi Ders Programı
        </h2>
        <ScheduleList
          items={resmi}
          getName={scheduleName}
          getSubtitle={scheduleSubtitle}
          deletingId={deletingId}
          onDelete={handleDelete}
        />
        {resmi.length === 0 && (
          <p className="text-sm text-gray-400 dark:text-slate-500 py-4 text-center border border-dashed border-gray-200 dark:border-slate-700 rounded-xl">
            Henüz resmi ders programı eklenmemiş.
          </p>
        )}
      </section>

      {/* Okul Programı section */}
      <section>
        <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
          {editingLabel ? (
            <span className="flex items-center gap-2">
              <input
                value={labelValue}
                onChange={e => setLabelValue(e.target.value)}
                className="border border-gray-300 dark:border-slate-600 rounded px-2 py-0.5 text-sm text-gray-900 dark:text-slate-100 bg-white dark:bg-slate-800 w-48"
                autoFocus
                onKeyDown={e => { if (e.key === 'Enter') handleSaveLabel(); if (e.key === 'Escape') setEditingLabel(false) }}
              />
              <button
                onClick={handleSaveLabel}
                disabled={savingLabel}
                className="text-xs px-2 py-0.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {savingLabel ? '...' : 'Kaydet'}
              </button>
              <button onClick={() => setEditingLabel(false)} className="text-xs text-gray-500 hover:text-gray-700">İptal</button>
            </span>
          ) : (
            <span className="flex items-center gap-1.5">
              {labelValue}
              <button
                onClick={() => setEditingLabel(true)}
                title="İsmi değiştir"
                className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
              </button>
            </span>
          )}
        </h2>
        <ScheduleList
          items={okul}
          getName={scheduleName}
          getSubtitle={scheduleSubtitle}
          deletingId={deletingId}
          onDelete={handleDelete}
        />
        {okul.length === 0 && (
          <p className="text-sm text-gray-400 dark:text-slate-500 py-4 text-center border border-dashed border-gray-200 dark:border-slate-700 rounded-xl">
            Henüz {labelValue} eklenmemiş.
          </p>
        )}
      </section>
    </div>
  )
}

function ScheduleList({
  items,
  getName,
  getSubtitle,
  deletingId,
  onDelete,
}: {
  items: Schedule[]
  getName: (s: Schedule) => string
  getSubtitle: (s: Schedule) => string
  deletingId: string | null
  onDelete: (id: string) => void
}) {
  if (items.length === 0) return null
  return (
    <ul className="space-y-2">
      {items.map(s => (
        <li key={s.id} className="flex items-center justify-between gap-3 p-3 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl">
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">{getName(s)}</p>
            {getSubtitle(s) && <p className="text-xs text-gray-500 dark:text-slate-400">{getSubtitle(s)}</p>}
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
              {s.slots.length > 0 ? `${s.slots.length} ders girilmiş` : 'Henüz program girilmemiş'} · {s.period_count} ders/gün
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href={`/ders-programi/${s.id}`}
              className="px-3 py-1.5 text-xs font-medium bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors"
            >
              Düzenle
            </Link>
            <button
              onClick={() => onDelete(s.id)}
              disabled={deletingId === s.id}
              className="px-3 py-1.5 text-xs font-medium bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900 transition-colors disabled:opacity-50"
            >
              {deletingId === s.id ? '...' : 'Sil'}
            </button>
          </div>
        </li>
      ))}
    </ul>
  )
}
