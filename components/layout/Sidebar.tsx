'use client'

import { useState, useEffect, type ReactNode } from 'react'
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
import EduDeskLogo from '@/components/EduDeskLogo'

type SidebarProfile = Pick<Profile, 'id' | 'full_name' | 'subject' | 'role'>

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

const navItems: { href: string; label: string; mobile: boolean; roles: Role[] | null; icon: ReactNode }[] = [
  {
    href: '/anasayfa',
    label: 'Anasayfa',
    mobile: true,
    roles: null,
    icon: <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l9-9 9 9M5 10v10a1 1 0 001 1h3a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1h3a1 1 0 001-1V10" /></svg>,
  },
  {
    href: '/yonetim',
    label: 'Okul Durumu',
    mobile: false,
    roles: ['mudur', 'mudur_yardimcisi'],
    icon: <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
  },
  {
    href: '/odevler',
    label: 'Ödevler',
    mobile: true,
    roles: ['ogretmen', 'zumre_baskani'],
    icon: <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>,
  },
  {
    href: '/yoklama',
    label: 'Yoklama',
    mobile: true,
    roles: ['ogretmen', 'zumre_baskani', 'mudur_yardimcisi'],
    icon: <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>,
  },
  {
    href: '/siniflar',
    label: 'Sınıflar',
    mobile: true,
    roles: ['ogretmen', 'zumre_baskani', 'mudur_yardimcisi'],
    icon: <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  },
  {
    href: '/profil',
    label: 'Profil',
    mobile: false,
    roles: null,
    icon: <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
  },
  {
    href: '/ayarlar',
    label: 'Ayarlar',
    mobile: false,
    roles: null,
    icon: <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><circle cx="12" cy="12" r="3" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  },
  {
    href: '/rapor/devamsizlik',
    label: 'Devamsızlık Raporu',
    mobile: false,
    roles: ['mudur', 'mudur_yardimcisi'],
    icon: <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
  },
  {
    href: '/rapor/ogretmen-aktivite',
    label: 'Öğretmen Aktivitesi',
    mobile: false,
    roles: ['mudur', 'mudur_yardimcisi'],
    icon: <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>,
  },
  {
    href: '/kullanicilar',
    label: 'Kullanıcılar',
    mobile: false,
    roles: ['mudur', 'mudur_yardimcisi'],
    icon: <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
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

  const [collapsed, setCollapsed] = useState(false)
  useEffect(() => {
    if (localStorage.getItem('sidebar-collapsed') === 'true') setCollapsed(true)
  }, [])

  function toggleCollapsed() {
    setCollapsed(v => {
      localStorage.setItem('sidebar-collapsed', String(!v))
      return !v
    })
  }

  const filteredNav = navItems.filter(item => !item.roles || item.roles.includes(role as Role))

  return (
    <>
      {/* Mobile header */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-40 h-14 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <EduDeskLogo size="sm" />
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
          <NotificationBell align="right" userId={profile?.id} />
          <ThemeToggle />
        </div>
      </header>

      {/* Desktop sidebar */}
      <aside className={`hidden md:flex flex-col shrink-0 bg-white dark:bg-slate-900 border-r border-gray-200 dark:border-slate-700 transition-all duration-200 ${collapsed ? 'w-16' : 'w-60'}`}>

        {/* Header */}
        <div className="px-3 py-4 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between gap-2">
          {!collapsed && (
            <div className="min-w-0">
              <EduDeskLogo size="md" />
              <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{getEgitimYili()}</p>
            </div>
          )}
          <div className={`flex items-center gap-1 ${collapsed ? 'w-full justify-center flex-col' : 'shrink-0'}`}>
            <ThemeToggle />
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto overflow-x-hidden">
          {filteredNav.map(({ href, label, icon }) => {
            const active = pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                title={collapsed ? label : undefined}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  collapsed ? 'justify-center' : ''
                } ${
                  active
                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                    : 'text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-slate-100'
                }`}
              >
                {icon}
                {!collapsed && <span className="truncate">{label}</span>}
              </Link>
            )
          })}
        </nav>

        {/* Toggle + user + logout */}
        <div className="p-2 border-t border-gray-200 dark:border-slate-700 space-y-1">
          {/* Collapse toggle */}
          <button
            onClick={toggleCollapsed}
            title={collapsed ? 'Menüyü genişlet' : 'Menüyü daralt'}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-gray-400 dark:text-slate-500 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-600 dark:hover:text-slate-300 transition-colors ${collapsed ? 'justify-center' : ''}`}
          >
            <svg className={`w-4 h-4 shrink-0 transition-transform duration-200 ${collapsed ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
            {!collapsed && <span>Daralt</span>}
          </button>

          {/* User info */}
          {!collapsed && (
            <div className="px-3 py-2 rounded-lg bg-gray-50 dark:bg-slate-800">
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
          )}

          {!collapsed && (
            <div className="flex items-center gap-1">
              <FeedbackButton />
            </div>
          )}

          <form action={logout}>
            <button
              type="submit"
              title={collapsed ? 'Çıkış Yap' : undefined}
              className={`w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-slate-100 transition-colors ${collapsed ? 'justify-center' : ''}`}
            >
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
              {!collapsed && 'Çıkış Yap'}
            </button>
          </form>
        </div>
      </aside>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-slate-900 border-t border-gray-200 dark:border-slate-700 flex" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
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
                    className={`flex-1 h-16 flex flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors ${
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
