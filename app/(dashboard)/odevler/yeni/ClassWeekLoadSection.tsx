'use client'

import { useState, useEffect } from 'react'
import { getClassWeekLoad } from '@/app/actions/homework'
import type { ClassWeekLoad } from '@/src/domains/homework/lib/week-load'
import WeekLoadBanner from '@/app/(dashboard)/odevler/WeekLoadBanner'

function todayISO() {
  return new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Istanbul' }).format(new Date())
}

const field =
  'w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-base text-gray-900 placeholder:text-gray-400 hover:border-gray-300 focus:outline-none focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 transition-all duration-200'

export default function ClassWeekLoadSection({
  isTemplate, selectedClasses, initialDueDate = '',
}: {
  isTemplate: boolean
  selectedClasses: string[]
  initialDueDate?: string
}) {
  const [dueDate, setDueDate] = useState(initialDueDate)
  const [weekLoad, setWeekLoad] = useState<ClassWeekLoad[]>([])
  const [loadingLoad, setLoadingLoad] = useState(false)

  useEffect(() => {
    if (isTemplate || selectedClasses.length === 0 || !dueDate) { setWeekLoad([]); return }
    let active = true
    setLoadingLoad(true)
    getClassWeekLoad(selectedClasses, dueDate)
      .then(result => { if (active) { setWeekLoad(result); setLoadingLoad(false) } })
      .catch(() => { if (active) { setWeekLoad([]); setLoadingLoad(false) } })
    return () => { active = false }
  }, [selectedClasses, dueDate, isTemplate])

  if (isTemplate) return null

  return (
    <>
      <div className="space-y-2">
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">Son Teslim Tarihi</label>
        <input
          name="due_date"
          type="date"
          required={!isTemplate}
          min={todayISO()}
          className={field}
          value={dueDate}
          onChange={e => setDueDate(e.target.value)}
        />
      </div>
      <WeekLoadBanner loads={weekLoad} loading={loadingLoad} dueDate={dueDate} isCreating />
    </>
  )
}
