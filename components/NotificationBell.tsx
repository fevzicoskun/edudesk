'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { getNotifications, getUnreadCount, markAllRead, markRead } from '@/src/domains/notifications/actions'
import { createClient } from '@/src/infrastructure/supabase/client'

type Notification = {
  id: string
  title: string
  body: string | null
  homework_id: string | null
  read_at: string | null
  created_at: string
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'Az önce'
  if (diffMin < 60) return `${diffMin} dk önce`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr} saat önce`
  const diffDays = Math.floor(diffHr / 24)
  if (diffDays === 1) return 'Dün'
  if (diffDays < 7) return `${diffDays} gün önce`
  return new Date(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })
}

export default function NotificationBell({ align = 'right' }: { align?: 'left' | 'right' }) {
  const [open, setOpen] = useState(false)
  const [unread, setUnread] = useState(0)
  const [items, setItems] = useState<Notification[]>([])
  const [loaded, setLoaded] = useState(false)
  const [, startTransition] = useTransition()
  const ref = useRef<HTMLDivElement>(null)
  // Ref instead of state so Realtime callback always sees the latest value
  const loadedRef = useRef(false)

  useEffect(() => { loadedRef.current = loaded }, [loaded])

  // Initial unread count + Realtime subscription (replaces 30s polling)
  useEffect(() => {
    let active = true
    const supabase = createClient()
    let channel: ReturnType<typeof supabase.channel> | null = null

    // Initial count via server action (RLS-safe)
    getUnreadCount().then(count => { if (active) setUnread(count) })

    // Set up WebSocket subscription for new inserts
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!active || !session?.user) return

      channel = supabase
        .channel('notif-bell')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${session.user.id}`,
          },
          (payload) => {
            setUnread(prev => prev + 1)
            // Prepend to list only if dropdown was already loaded
            if (loadedRef.current) {
              setItems(prev => [payload.new as Notification, ...prev])
            }
          }
        )
        .subscribe()
    })

    return () => {
      active = false
      if (channel) supabase.removeChannel(channel)
    }
  }, [])

  useEffect(() => {
    function handleOutside(e: MouseEvent | TouchEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleOutside)
    document.addEventListener('touchstart', handleOutside, { passive: true })
    return () => {
      document.removeEventListener('mousedown', handleOutside)
      document.removeEventListener('touchstart', handleOutside)
    }
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
  }

  function handleMarkOne(id: string) {
    setItems(prev => prev.map(n => n.id === id ? { ...n, read_at: new Date().toISOString() } : n))
    setUnread(prev => Math.max(0, prev - 1))
    startTransition(async () => { await markRead(id) })
  }

  function handleMarkAll() {
    const now = new Date().toISOString()
    setItems(prev => prev.map(n => ({ ...n, read_at: n.read_at ?? now })))
    setUnread(0)
    startTransition(async () => { await markAllRead() })
  }

  const unreadItems = items.filter(n => !n.read_at)
  const readItems = items.filter(n => n.read_at)

  return (
    <div ref={ref} className="relative">
      <button
        onClick={handleOpen}
        aria-label={`Bildirimler${unread > 0 ? `, ${unread} okunmamış` : ''}`}
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

          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-900 dark:text-slate-100">Bildirimler</span>
              {unread > 0 && (
                <span className="text-[10px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 px-1.5 py-0.5 rounded-full">{unread} yeni</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {unread > 0 && (
                <button
                  onClick={handleMarkAll}
                  className="text-xs text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
                >
                  Tümünü okundu yap
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                aria-label="Kapat"
                className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 p-0.5 rounded"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="max-h-[400px] overflow-y-auto">
            {!loaded ? (
              <div className="px-4 py-10 flex flex-col items-center gap-3 text-gray-400">
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span className="text-sm">Yükleniyor...</span>
              </div>
            ) : items.length === 0 ? (
              <div className="px-4 py-10 flex flex-col items-center gap-2 text-center">
                <svg className="w-10 h-10 text-gray-200 dark:text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                <p className="text-sm font-medium text-gray-500 dark:text-slate-400">Henüz bildirim yok</p>
                <p className="text-xs text-gray-400 dark:text-slate-500">Ödev güncellemeleri ve önemli gelişmeler burada görünür.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-slate-800">
                {unreadItems.map((n) => (
                  <NotifItem key={n.id} n={n} onMark={handleMarkOne} onClose={() => setOpen(false)} />
                ))}
                {unreadItems.length > 0 && readItems.length > 0 && (
                  <div className="px-4 py-1.5 text-[10px] font-semibold text-gray-400 dark:text-slate-600 uppercase tracking-wider bg-gray-50/60 dark:bg-slate-800/40">
                    Okunmuş
                  </div>
                )}
                {readItems.map((n) => (
                  <NotifItem key={n.id} n={n} onMark={handleMarkOne} onClose={() => setOpen(false)} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function NotifItem({ n, onMark, onClose }: { n: Notification; onMark: (id: string) => void; onClose: () => void }) {
  const isUnread = !n.read_at
  const inner = (
    <>
      <div className="flex items-start gap-2.5">
        {isUnread && (
          <span className="mt-1.5 w-2 h-2 rounded-full bg-blue-500 shrink-0" />
        )}
        <div className={`flex-1 min-w-0 ${!isUnread ? 'pl-4' : ''}`}>
          <p className={`text-sm leading-snug ${isUnread ? 'font-semibold text-gray-900 dark:text-slate-100' : 'font-medium text-gray-600 dark:text-slate-400'}`}>
            {n.title}
          </p>
          {n.body && (
            <p className="text-xs text-gray-500 dark:text-slate-500 mt-0.5 line-clamp-2">{n.body}</p>
          )}
          <p className="text-[11px] text-gray-400 dark:text-slate-600 mt-1">{relativeTime(n.created_at)}</p>
        </div>
      </div>
    </>
  )

  const cls = `px-4 py-3 transition-colors ${isUnread ? 'bg-blue-50/50 dark:bg-blue-950/20 hover:bg-blue-50 dark:hover:bg-blue-950/30' : 'hover:bg-gray-50 dark:hover:bg-slate-800/50'}`

  if (n.homework_id) {
    return (
      <Link
        href={`/odevler/${n.homework_id}`}
        onClick={() => { if (isUnread) onMark(n.id); onClose() }}
        className={`block ${cls}`}
      >
        {inner}
      </Link>
    )
  }

  return (
    <div
      onClick={() => { if (isUnread) onMark(n.id) }}
      className={`${cls} ${isUnread ? 'cursor-pointer' : ''}`}
    >
      {inner}
    </div>
  )
}
