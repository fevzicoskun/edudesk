'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { Role } from '@/src/shared/types'

type NavItem = {
  href: string
  label: string
  icon: React.ReactNode
  roles: Role[] | null
}

export default function MobileNavDrawer({ items, role }: { items: NavItem[]; role: Role | undefined }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  useEffect(() => { setOpen(false) }, [pathname])

  const visible = items.filter(i => !i.roles || i.roles.includes(role as Role))
  if (visible.length === 0) return null

  return (
    <>
      {/* Trigger button — shown in bottom nav by parent */}
      <button
        onClick={() => setOpen(true)}
        className="flex-1 flex flex-col items-center justify-center gap-0.5 text-xs font-medium text-gray-500 dark:text-slate-400"
        aria-label="Daha fazla"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h.01M12 12h.01M19 12h.01" />
        </svg>
        <span className="text-[10px]">Daha Fazla</span>
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Drawer sheet */}
      <div className={`fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-slate-900 border-t border-gray-200 dark:border-slate-700 rounded-t-2xl transition-transform duration-300 ${open ? 'translate-y-0' : 'translate-y-full'}`}>
        <div className="flex justify-center pt-2.5 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-slate-600" />
        </div>
        <nav className="px-4 pb-safe-or-4 grid grid-cols-4 gap-1 pt-3">
          {visible.map(item => {
            const active = pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl text-xs font-medium transition-colors ${
                  active
                    ? 'bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400'
                    : 'text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800'
                }`}
              >
                {item.icon}
                <span className="text-center leading-tight">{item.label}</span>
              </Link>
            )
          })}
        </nav>
      </div>
    </>
  )
}
