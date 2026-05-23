'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { getNotifications, getUnreadCount, markAllRead } from '@/src/domains/notifications/actions'

type Notification = {
  id: string
  title: string
  body: string | null
  homework_id: string | null
  read_at: string | null
  created_at: string
}

export default function NotificationBell({ align = 'right' }: { align?: 'left' | 'right' }) {
  const [open, setOpen] = useState(false)
  const [unread, setUnread] = useState(0)
  const [items, setItems] = useState<Notification[]>([])
  const [loaded, setLoaded] = useState(false)
  const [, startTransition] = useTransition()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    getUnreadCount().then(setUnread)
  }, [])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function handleOpen() {
    if (open) { setOpen(false); return }
    setOpen(true)
    if (!loaded) {
      startTransition(async () => {
        const data = await getNotifications()
        setItems(data as Notification[])
        setLoaded(true)
      })
    }
    if (unread > 0) {
      startTransition(async () => {
        await markAllRead()
        setUnread(0)
      })
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={handleOpen}
        aria-label="Bildirimler"
        className="relative p-2 rounded-lg text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unread > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-0.5 leading-none">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className={`absolute top-full mt-2 w-80 max-w-[calc(100vw-1rem)] bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl shadow-lg z-50 overflow-hidden ${align === 'right' ? 'right-0' : 'left-0'}`}>
          <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-900 dark:text-slate-100">Bildirimler</span>
            <button
              onClick={() => setOpen(false)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-gray-100 dark:divide-slate-700">
            {!loaded ? (
              <div className="px-4 py-8 text-center text-sm text-gray-400">Yükleniyor...</div>
            ) : items.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-400">Bildirim yok.</div>
            ) : (
              items.map((n) => (
                <div
                  key={n.id}
                  className={`px-4 py-3 ${!n.read_at ? 'bg-blue-50/60 dark:bg-blue-950/20' : ''}`}
                >
                  {n.homework_id ? (
                    <Link
                      href={`/odevler/${n.homework_id}`}
                      onClick={() => setOpen(false)}
                      className="block"
                    >
                      <p className="text-sm font-medium text-gray-900 dark:text-slate-100">{n.title}</p>
                      {n.body && <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5 line-clamp-2">{n.body}</p>}
                    </Link>
                  ) : (
                    <>
                      <p className="text-sm font-medium text-gray-900 dark:text-slate-100">{n.title}</p>
                      {n.body && <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5 line-clamp-2">{n.body}</p>}
                    </>
                  )}
                  <p className="text-[11px] text-gray-300 dark:text-slate-600 mt-1">
                    {new Date(n.created_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
