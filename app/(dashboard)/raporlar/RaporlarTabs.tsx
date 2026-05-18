'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const BASE_TABS = [
  { href: '/raporlar/ogrenci', label: 'Öğrenci' },
  { href: '/raporlar/sinif', label: 'Sınıf' },
  { href: '/raporlar/ogretmen', label: 'Öğretmen' },
]

const MENTOR_TAB = { href: '/raporlar/mentor', label: 'Mentör' }

export default function RaporlarTabs({ showMentorTab }: { showMentorTab: boolean }) {
  const pathname = usePathname()
  const tabs = showMentorTab ? [...BASE_TABS, MENTOR_TAB] : BASE_TABS

  return (
    <nav className="flex gap-1 mb-6 bg-gray-100 dark:bg-slate-800 p-1 rounded-xl overflow-x-auto">
      {tabs.map(tab => {
        const active = pathname.startsWith(tab.href)
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex-1 text-center px-3 py-2 rounded-lg text-sm font-medium transition-colors min-h-[44px] flex items-center justify-center whitespace-nowrap ${
              active
                ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 shadow-sm'
                : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-100'
            }`}
          >
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
