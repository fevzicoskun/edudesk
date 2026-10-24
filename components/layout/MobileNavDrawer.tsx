'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { Role } from '@/src/shared/types'
import { logout } from '@/src/domains/auth/actions'

type NavItem = {
  href: string
  label: string
  icon: React.ReactNode
  roles: Role[] | null
}

const altLink = (aktif: boolean, girinti = 'pl-3') => `flex items-center min-h-[44px] ${girinti} pr-3 rounded-xl text-sm ${aktif
  ? 'bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 font-medium' : 'text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800'}`

/** mentor: masaüstü menüdeki Mentörlük alt menüsünün telefon karşılığı (Mentörlük alt barda, alt menü buraya) */
export default function MobileNavDrawer({ items, role, aktif, mentor }: {
  items: NavItem[]; role: Role | undefined; aktif: string | null
  mentor?: { planOgrencileri: { id: string; ad: string }[] } | null
}) {
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
            const active = item.href === aktif
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
        {mentor && (
          <div className="px-4 pb-safe-or-4 pt-1 max-h-[45vh] overflow-y-auto border-t border-gray-100 dark:border-slate-800">
            <p className="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-slate-400">Mentörlük</p>
            <Link href="/mentorluk/bulten" className={altLink(pathname === '/mentorluk/bulten')}>Haftalık veli bülteni</Link>
            {mentor.planOgrencileri.length > 0 && (
              <details open={mentor.planOgrencileri.some(o => pathname.startsWith(`/mentorluk/${o.id}/takip`))}>
                <summary className={`${altLink(false)} cursor-pointer`}>Haftalık planlar</summary>
                <Link href="/mentorluk/takip-kagitlari"
                  className={`${altLink(pathname === '/mentorluk/takip-kagitlari', 'pl-8')} font-medium`}>Tüm planları yazdır</Link>
                {mentor.planOgrencileri.map(o => (
                  <Link key={o.id} href={`/mentorluk/${o.id}/takip?sekme=plan`}
                    className={altLink(pathname.startsWith(`/mentorluk/${o.id}/takip`), 'pl-8')}>{o.ad}</Link>
                ))}
              </details>
            )}
            {mentor.planOgrencileri.length > 0 && <>
              <Link href="/mentorluk/denemeler" className={altLink(pathname === '/mentorluk/denemeler')}>Denemeler</Link>
              <Link href="/mentorluk/veli-toplantisi" className={altLink(pathname === '/mentorluk/veli-toplantisi')}>Veli toplantısı</Link>
            </>}
          </div>
        )}
        {/* Telefonda masaüstü kenar menüsü yok; çıkış menünün altında (Profil sayfasındaki düğme kalktı, 2026-10-24) */}
        <form action={logout} className="px-4 pt-1 pb-safe-or-4 border-t border-gray-100 dark:border-slate-800">
          <button type="submit" className="w-full flex items-center gap-2 min-h-[44px] px-3 rounded-xl text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-slate-800">
            <svg aria-hidden className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            Çıkış Yap
          </button>
        </form>
      </div>
    </>
  )
}
