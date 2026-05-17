'use client'

import { useState, useTransition } from 'react'
import { assignRole } from '@/app/actions/kullanicilar'
import { ROLE_LABELS, type Role } from '@/lib/types'

const BADGE: Record<string, string> = {
  mudur:            'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300',
  mudur_yardimcisi: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300',
  zumre_baskani:    'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  ogretmen:         'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-300',
}

export default function RoleSelector({
  userId,
  currentRole,
  assignableRoles,
}: {
  userId: string
  currentRole: Role
  assignableRoles: Role[]
}) {
  const [role, setRole] = useState(currentRole)
  const [open, setOpen] = useState(false)
  const [, startTransition] = useTransition()

  const handleSelect = (newRole: Role) => {
    if (newRole === role) { setOpen(false); return }
    setOpen(false)
    const prev = role
    setRole(newRole)
    startTransition(async () => {
      try {
        await assignRole(userId, newRole)
      } catch {
        setRole(prev)
      }
    })
  }

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen(o => !o)}
        className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full cursor-pointer hover:opacity-80 transition-opacity ${BADGE[role] ?? BADGE.ogretmen}`}
      >
        {ROLE_LABELS[role] ?? role}
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 z-20 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-lg py-1 min-w-max">
            {assignableRoles.map(r => (
              <button
                key={r}
                onClick={() => handleSelect(r)}
                className={`w-full text-left px-3 py-1.5 text-xs font-medium hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors ${r === role ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-slate-300'}`}
              >
                {r === role && '✓ '}{ROLE_LABELS[r] ?? r}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
