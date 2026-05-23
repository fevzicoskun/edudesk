'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { logout } from '@/src/domains/auth/actions'
import type { Profile, Role } from '@/src/shared/types'
import { ROLE_LABELS, isMudurOrAbove, isYonetici } from '@/src/shared/types'
import { getEgitimYili } from '@/src/shared/utils'
import ThemeToggle from '@/components/ThemeToggle'
import MobileNavDrawer from '@/components/layout/MobileNavDrawer'
import FeedbackButton from '@/components/FeedbackButton'
import NotificationBell from '@/components/NotificationBell'

type SidebarProfile = Pick<Profile, 'full_name' | 'subject' | 'role'>

function formatName(raw: string): string {
  return raw
    .replace(/\d+/g, '')
    .replace(/[._-]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ') || raw
}

const navItems: { href: string; label: string; mobile: boolean; roles: Role[] | null; icon: React.ReactNode; subItems?: { href: string; label: string; mentorOnly?: boolean }[] }[] = [
  {
    href: '/anasayfa',
    label: 'Anasayfa',
    mobile: true,
    roles: null,
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l9-9 9 9M5 10v10a1 1 0 001 1h3a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1h3a1 1 0 001-1V10" /></svg>,
  },
  {
    href: '/odevler',
    label: 'Ödevler',
    mobile: true,
    roles: ['ogretmen', 'zumre_baskani'],
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>,
  },
  {
    href: '/siniflar',
    label: 'Sınıflar',
    mobile: true,
    roles: ['ogretmen', 'zumre_baskani', 'mudur_yardimcisi'],
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  },
  {
    href: '/profil',
    label: 'Profil',
    mobile: false,
    roles: null,
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
  },
  {
    href: '/ayarlar',
    label: 'Ayarlar',
    mobile: false,
    roles: null,
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><circle cx="12" cy="12" r="3" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  },
  {
    href: '/kullanicilar',
    label: 'Kullanıcılar',
    mobile: false,
    roles: ['mudur'],
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
  },
  {
    href: '/yonetim',
    label: 'Toplantılar',
    mobile: false,
    roles: ['mudur'],
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
  },
]

export default function Sidebar({ profile, email }: { profile: SidebarProfile | null; email: string }) {
  const pathname = usePathname()
  const rawName = profile?.full_name || email.split('@')[0]
  const displayName = formatName(rawName)
  const role = profile?.role as Role | undefined
  const isMudur = isMudurOrAbove(role)
  const isYoneticiUser = isYonetici(role)
  const roleLabel = role ? ROLE_LABELS[role] ?? 'Öğretmen' : 'Öğretmen'

  return (
    <>
      {/* Mobile header */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-40 h-14 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <p className="font-bold text-gray-900 dark:text-slate-100">EduDesk</p>
          {isYoneticiUser && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
              isMudur ? 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300'
                      : 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
            }`}>
              {roleLabel}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <NotificationBell align="right" />
          <ThemeToggle />
        </div>
      </header>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-60 bg-white dark:bg-slate-900 border-r border-gray-200 dark:border-slate-700 flex-col shrink-0">
        <div className="px-5 py-4 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
          <div>
            <p className="font-bold text-gray-900 dark:text-slate-100 text-base">EduDesk</p>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{getEgitimYili()}</p>
          </div>
          <div className="flex items-center gap-1">
            <NotificationBell align="left" />
            <ThemeToggle />
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {navItems.filter(item => !item.roles || item.roles.includes(role as Role)).map(({ href, label, icon, subItems }) => {
            const active = pathname.startsWith(href)
            return (
              <div key={href}>
                <Link
                  href={href}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    active
                      ? 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                      : 'text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-slate-100'
                  }`}
                >
                  {icon}
                  {label}
                </Link>
                {subItems && active && (
                  <div className="ml-8 mt-0.5 space-y-0.5">
                    {subItems
                      .filter(sub => !sub.mentorOnly || ['mudur', 'mudur_yardimcisi', 'zumre_baskani'].includes(role ?? ''))
                      .map(sub => {
                        const subActive = pathname.startsWith(sub.href)
                        return (
                          <Link
                            key={sub.href}
                            href={sub.href}
                            className={`block px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                              subActive
                                ? 'text-blue-700 dark:text-blue-300 bg-blue-50/50 dark:bg-blue-950/50'
                                : 'text-gray-500 dark:text-slate-500 hover:text-gray-800 dark:hover:text-slate-300'
                            }`}
                          >
                            {sub.label}
                          </Link>
                        )
                      })}
                  </div>
                )}
              </div>
            )
          })}
        </nav>

        {/* User + logout */}
        <div className="p-3 border-t border-gray-200 dark:border-slate-700">
          <div className="px-3 py-2 mb-1 rounded-lg bg-gray-50 dark:bg-slate-800">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-gray-900 dark:text-slate-100 truncate flex-1">{displayName}</p>
              {isYoneticiUser && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold shrink-0 ${
                  isMudur ? 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300'
                           : 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                }`}>
                  {isMudur ? (role === 'mudur' ? 'Müdür' : 'Müd.Yrd.') : 'Başkan'}
                </span>
              )}
            </div>
            {profile?.subject && (
              <p className="text-xs text-gray-400 dark:text-slate-500 truncate mt-0.5">{profile.subject}</p>
            )}
            <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-0.5">{roleLabel}</p>
          </div>
          <FeedbackButton />
          <form action={logout}>
            <button
              type="submit"
              className="w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-slate-100 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
              Çıkış Yap
            </button>
          </form>
        </div>
      </aside>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 h-16 bg-white dark:bg-slate-900 border-t border-gray-200 dark:border-slate-700 flex">
        {(() => {
          const mobileItems = navItems.filter(i => i.mobile && (!i.roles || i.roles.includes(role as Role)))
          const drawerItems = navItems.filter(i => !i.mobile && (!i.roles || i.roles.includes(role as Role)))
          const MAX_NAV = 5
          const showDrawer = drawerItems.length > 0
          const visibleMobile = showDrawer ? mobileItems.slice(0, MAX_NAV - 1) : mobileItems.slice(0, MAX_NAV)
          return (
            <>
              {visibleMobile.map(({ href, label, icon }) => {
                const active = pathname.startsWith(href)
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors ${
                      active ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-slate-500'
                    }`}
                  >
                    {icon}
                    <span className="text-[10px]">{label}</span>
                  </Link>
                )
              })}
              {showDrawer && (
                <MobileNavDrawer items={drawerItems} role={role} />
              )}
            </>
          )
        })()}
      </nav>
    </>
  )
}
