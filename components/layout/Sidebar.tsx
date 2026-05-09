'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { logout } from '@/app/actions/auth'
import type { Profile } from '@/lib/types'
import { getEgitimYili } from '../../lib/utils';

const navItems = [
  {
    href: '/anasayfa',
    label: 'Anasayfa',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l9-9 9 9M5 10v10a1 1 0 001 1h3a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1h3a1 1 0 001-1V10" />
      </svg>
    ),
  },
  {
    href: '/odevler',
    label: 'Ödevler',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    ),
  },
  {
    href: '/siniflar',
    label: 'Sınıflar',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    href: '/zumre',
    label: 'Zümre',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
]

export default function Sidebar({ profile }: { profile: Profile | null }) {
  const pathname = usePathname()

  return (
    <>
      <header className="md:hidden fixed top-0 left-0 right-0 z-40 h-14 bg-white border-b border-gray-200 flex items-center px-4">
        <p className="font-bold text-gray-900">Zümre Takip</p>
      </header>

      <aside className="hidden md:flex w-60 bg-white border-r border-gray-200 flex-col shrink-0">
        <div className="px-5 py-5 border-b border-gray-200">
          <p className="font-bold text-gray-900 text-base">Zümre Takip</p>
          <p className="text-xs text-gray-400 mt-0.5">{getEgitimYili()}</p>
        </div>

        <nav className="flex-1 p-3 space-y-0.5">
          {navItems.map(({ href, label, icon }) => {
            const active = pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                {icon}
                {label}
              </Link>
            )
          })}
        </nav>

        <div className="p-3 border-t border-gray-200">
          <div className="px-3 py-2 mb-1">
            <p className="text-sm font-medium text-gray-900 truncate">{profile?.full_name ?? '—'}</p>
            <p className="text-xs text-gray-400 truncate">
              {profile?.role === 'zumre_baskani' ? 'Zümre Başkanı' : 'Öğretmen'}
              {profile?.subject ? ` · ${profile.subject}` : ''}
            </p>
          </div>
          <form action={logout}>
            <button
              type="submit"
              className="w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Çıkış Yap
            </button>
          </form>
        </div>
      </aside>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 h-16 bg-white border-t border-gray-200 flex">
        {navItems.map(({ href, label, icon }) => {
          const active = pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors ${
                active ? 'text-blue-600' : 'text-gray-400'
              }`}
            >
              {icon}
              <span>{label}</span>
            </Link>
          )
        })}
        <form action={logout} className="flex-1">
          <button
            type="submit"
            className="w-full h-full flex flex-col items-center justify-center gap-0.5 text-xs font-medium text-gray-400"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span>Çıkış</span>
          </button>
        </form>
      </nav>
    </>
  )
}