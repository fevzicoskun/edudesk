'use client'

import { useTransition } from 'react'
import { updateSchoolStatus } from './actions'

type Status = 'active' | 'trial' | 'suspended'

const OPTIONS: { value: Status; label: string; cls: string }[] = [
  { value: 'active',    label: 'Aktif',   cls: 'text-emerald-400 bg-emerald-950 border-emerald-800 hover:bg-emerald-900' },
  { value: 'trial',     label: 'Trial',   cls: 'text-amber-400 bg-amber-950 border-amber-800 hover:bg-amber-900' },
  { value: 'suspended', label: 'Askıda',  cls: 'text-red-400 bg-red-950 border-red-800 hover:bg-red-900' },
]

export default function StatusToggle({ schoolId, current }: { schoolId: string; current: string }) {
  const [pending, startTransition] = useTransition()

  return (
    <div className="flex items-center gap-1 bg-slate-800 border border-slate-700 rounded-lg p-1">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          disabled={pending || current === opt.value}
          onClick={() => startTransition(() => updateSchoolStatus(schoolId, opt.value))}
          className={`px-3 py-1 rounded-md text-xs font-medium border transition-all ${
            current === opt.value
              ? opt.cls + ' cursor-default'
              : 'text-slate-500 bg-transparent border-transparent hover:text-slate-300'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
