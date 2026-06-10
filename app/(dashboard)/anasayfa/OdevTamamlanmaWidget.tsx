'use client'

import { useState, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { OdevTamamlanmaItem } from '@/src/domains/dashboard/types'

const OdevTamamlanmaChart = dynamic(() => import('./OdevTamamlanmaChart'), { ssr: false })

function TabButton({
  id,
  label,
  selected,
  onSelect,
}: {
  id: string
  label: string
  selected: string
  onSelect: (id: string) => void
}) {
  const active = selected === id
  return (
    <button
      type="button"
      onClick={() => onSelect(id)}
      className={`text-[11px] font-medium px-2.5 py-1 rounded-full border transition-colors ${
        active
          ? 'bg-blue-600 text-white border-blue-600'
          : 'bg-white dark:bg-slate-800 text-gray-500 dark:text-slate-400 border-gray-200 dark:border-slate-700 hover:border-blue-400'
      }`}
    >
      {label}
    </button>
  )
}

export default function OdevTamamlanmaWidget({ data }: { data: OdevTamamlanmaItem[] }) {
  const [selectedClass, setSelectedClass] = useState('')

  const classes = useMemo(() => {
    const seen = new Map<string, string>()
    for (const d of data) {
      if (!seen.has(d.classId)) seen.set(d.classId, d.className)
    }
    return Array.from(seen.entries())
      .map(([classId, className]) => ({ classId, className }))
      .sort((a, b) => a.className.localeCompare(b.className, 'tr'))
  }, [data])

  const filteredData = useMemo(() => {
    if (selectedClass === '') return data.slice(-8)
    return data.filter(d => d.classId === selectedClass)
  }, [data, selectedClass])

  const subtitle = useMemo(() => {
    const count = filteredData.length
    if (count === 0) return 'Geçmiş ödev bulunamadı'
    const classLabel = selectedClass === '' ? 'Tüm sınıflar' : (classes.find(c => c.classId === selectedClass)?.className ?? '')
    const totalStudents = filteredData.reduce((s, d) => s + d.total, 0)
    if (totalStudents === 0) return `Son ${count} ödev · ${classLabel}`
    const avgPct = Math.round(filteredData.reduce((s, d) => s + d.yapildi, 0) / count)
    const totalDone = filteredData.reduce((s, d) => s + d.yapildiCount, 0)
    return `Son ${count} ödev · ${classLabel} · ort. %${avgPct} · ${totalDone}/${totalStudents} öğrenci`
  }, [filteredData, selectedClass, classes])

  return (
    <Card className="border-gray-200 dark:border-slate-700 shadow-sm">
      <CardHeader className="pb-1">
        <CardTitle className="text-sm font-semibold text-gray-700 dark:text-slate-300">
          Ödev Tamamlanma Oranları
        </CardTitle>
        <p className="text-xs text-gray-400 dark:text-slate-500">{subtitle}</p>
      </CardHeader>

      {classes.length > 1 && (
        <div className="px-4 pb-2 flex gap-1 flex-wrap">
          <TabButton id="" label="Tümü" selected={selectedClass} onSelect={setSelectedClass} />
          {classes.map(c => (
            <TabButton
              key={c.classId}
              id={c.classId}
              label={c.className}
              selected={selectedClass}
              onSelect={setSelectedClass}
            />
          ))}
        </div>
      )}

      <CardContent className="pt-2 pb-4">
        {filteredData.length === 0 ? (
          <div className="h-40 flex items-center justify-center text-sm text-gray-400 dark:text-slate-500">
            Geçmiş ödev bulunamadı.
          </div>
        ) : (
          <OdevTamamlanmaChart data={filteredData} />
        )}
      </CardContent>
    </Card>
  )
}
