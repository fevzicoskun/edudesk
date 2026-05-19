'use client'

import { useState, useTransition } from 'react'
import { updateScheduleSlots } from '@/app/actions/schedules'

type Slot = { day: number; period: number; subject: string }

const DAYS = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma']

function slotKey(day: number, period: number) {
  return `${day}-${period}`
}

export default function DersProgramiEditorClient({
  scheduleId,
  initialSlots,
  initialPeriodCount,
}: {
  scheduleId: string
  initialSlots: Slot[]
  initialPeriodCount: number
}) {
  const [pending, startTransition] = useTransition()
  const [periodCount, setPeriodCount] = useState(initialPeriodCount)
  const [saved, setSaved] = useState(false)

  const [cells, setCells] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {}
    initialSlots.forEach(s => { map[slotKey(s.day, s.period)] = s.subject })
    return map
  })

  const [dragging, setDragging] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  const periods = Array.from({ length: periodCount }, (_, i) => i + 1)

  function handleCellClick(key: string) {
    if (editing === key) return
    setEditing(key)
    setEditValue(cells[key] ?? '')
  }

  function commitEdit(key: string) {
    setCells(prev => {
      const next = { ...prev }
      if (editValue.trim()) {
        next[key] = editValue.trim()
      } else {
        delete next[key]
      }
      return next
    })
    setSaved(false)
    setEditing(null)
  }

  function handleDragStart(key: string) {
    setDragging(key)
  }

  function handleDragOver(e: React.DragEvent, key: string) {
    e.preventDefault()
    setDragOver(key)
  }

  function handleDrop(targetKey: string) {
    if (!dragging) return
    if (dragging === targetKey) { setDragging(null); setDragOver(null); return }

    setCells(prev => {
      const next = { ...prev }
      const srcVal = next[dragging] ?? ''
      const dstVal = next[targetKey] ?? ''
      if (dstVal) next[dragging] = dstVal; else delete next[dragging]
      if (srcVal) next[targetKey] = srcVal; else delete next[targetKey]
      return next
    })

    setSaved(false)
    setDragging(null)
    setDragOver(null)
  }

  function handleSave() {
    const slots: Slot[] = Object.entries(cells).map(([key, subject]) => {
      const [day, period] = key.split('-').map(Number)
      return { day, period, subject }
    })
    startTransition(async () => {
      await updateScheduleSlots(scheduleId, slots, periodCount)
      setSaved(true)
    })
  }

  function handleClear() {
    if (!confirm('Tüm program içeriğini silmek istediğinize emin misiniz?')) return
    setCells({})
    setSaved(false)
  }

  const filledCount = Object.keys(cells).length
  const totalCells = periodCount * 5

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-slate-300">
            <span>Ders saati:</span>
            <input
              type="number"
              min={4}
              max={12}
              value={periodCount}
              onChange={e => { setPeriodCount(Number(e.target.value)); setSaved(false) }}
              className="w-16 border border-gray-300 dark:border-slate-600 rounded px-2 py-1 text-sm text-gray-900 dark:text-slate-100 bg-white dark:bg-slate-800"
            />
          </label>
          <span className="text-xs text-gray-400 dark:text-slate-500">{filledCount}/{totalCells} dolduruldu</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleClear}
            className="px-3 py-1.5 text-sm text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
          >
            Temizle
          </button>
          <button
            onClick={handleSave}
            disabled={pending}
            className="px-4 py-1.5 text-sm font-medium bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg transition-colors flex items-center gap-1.5"
          >
            {pending ? 'Kaydediliyor...' : saved ? '✓ Kaydedildi' : 'Kaydet'}
          </button>
        </div>
      </div>

      {/* Instructions */}
      <p className="text-xs text-gray-400 dark:text-slate-500">
        Hücreye <strong>tıklayın</strong> düzenlemek için · <strong>Sürükleyin</strong> hücreler arası taşımak için · Boş bırakırsanız silinir
      </p>

      {/* Grid */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-slate-700">
        <table className="w-full text-sm border-collapse min-w-[640px]">
          <thead>
            <tr className="bg-gray-50 dark:bg-slate-800">
              <th className="p-2.5 text-left text-xs font-semibold text-gray-500 dark:text-slate-400 w-20 border-b border-gray-200 dark:border-slate-700">Saat</th>
              {DAYS.map(d => (
                <th key={d} className="p-2.5 text-center text-xs font-semibold text-gray-700 dark:text-slate-300 border-b border-l border-gray-200 dark:border-slate-700">
                  {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {periods.map(period => (
              <tr key={period} className="border-b border-gray-100 dark:border-slate-800 last:border-0">
                <td className="p-2.5 text-xs font-semibold text-gray-500 dark:text-slate-400 bg-gray-50 dark:bg-slate-800 border-r border-gray-200 dark:border-slate-700">
                  {period}. Ders
                </td>
                {[1, 2, 3, 4, 5].map(day => {
                  const key = slotKey(day, period)
                  const val = cells[key] ?? ''
                  const isDragOver = dragOver === key
                  const isDragging = dragging === key

                  return (
                    <td
                      key={day}
                      className={`border-l border-gray-100 dark:border-slate-800 relative ${
                        isDragOver ? 'bg-blue-50 dark:bg-blue-950' : ''
                      } ${isDragging ? 'opacity-40' : ''}`}
                      onDragOver={e => handleDragOver(e, key)}
                      onDragLeave={() => setDragOver(null)}
                      onDrop={() => handleDrop(key)}
                    >
                      {editing === key ? (
                        <input
                          autoFocus
                          value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          onBlur={() => commitEdit(key)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') commitEdit(key)
                            if (e.key === 'Escape') setEditing(null)
                          }}
                          className="w-full h-full min-h-[44px] px-2 py-1.5 text-xs text-gray-900 dark:text-slate-100 bg-blue-50 dark:bg-blue-950 border-0 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
                          placeholder="Ders adı..."
                        />
                      ) : (
                        <div
                          draggable={!!val}
                          onDragStart={() => handleDragStart(key)}
                          onDragEnd={() => { setDragging(null); setDragOver(null) }}
                          onClick={() => handleCellClick(key)}
                          className={`min-h-[44px] px-2 py-1.5 cursor-pointer transition-colors select-none flex items-center ${
                            val
                              ? 'hover:bg-blue-50 dark:hover:bg-blue-950'
                              : 'hover:bg-gray-50 dark:hover:bg-slate-700/50'
                          }`}
                        >
                          {val ? (
                            <span className="text-xs text-gray-800 dark:text-slate-200 leading-tight">{val}</span>
                          ) : (
                            <span className="text-[10px] text-gray-300 dark:text-slate-600">+</span>
                          )}
                        </div>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
