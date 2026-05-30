'use client'

import { useState, useMemo } from 'react'
import { ROLE_LABELS, type Role } from '@/src/shared/types'
import RoleSelector from './RoleSelector'
import DeleteButton from './DeleteButton'

export type UserRow = {
  id: string
  full_name: string
  subject: string | null
  role: Role
}

export type SessionSummary = {
  count: number
  totalMinutes: number
  lastSeen: string | null
}

const ROLE_BADGE: Record<string, string> = {
  mudur:            'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300',
  mudur_yardimcisi: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300',
  zumre_baskani:    'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  ogretmen:         'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-300',
}

export default function KullaniciFiltreli({
  users,
  sessions,
  currentUserId,
  isMudur,
  canAssign,
  assignableRoles,
}: {
  users: UserRow[]
  sessions: Record<string, SessionSummary>
  currentUserId: string
  isMudur: boolean
  canAssign: boolean
  assignableRoles: Role[]
}) {
  const [search, setSearch]   = useState('')
  const [subject, setSubject] = useState('')
  const [role, setRole]       = useState('')
  const [sortAsc, setSortAsc] = useState(true)

  const uniqueSubjects = useMemo(() => {
    const s = new Set(users.map(u => u.subject).filter(Boolean) as string[])
    return Array.from(s).sort((a, b) => a.localeCompare('tr'))
  }, [users])

  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('tr')
    return users
      .filter(u => {
        if (q && !u.full_name.toLocaleLowerCase('tr').includes(q)) return false
        if (subject && u.subject !== subject) return false
        if (role && u.role !== role) return false
        return true
      })
      .sort((a, b) => {
        const cmp = a.full_name.localeCompare(b.full_name, 'tr')
        return sortAsc ? cmp : -cmp
      })
  }, [users, search, subject, role, sortAsc])

  const hasFilter = search || subject || role

  return (
    <div className="space-y-3">
      {/* Filtre çubuğu */}
      <div className="flex flex-wrap gap-2 items-center">
        {/* İsim arama */}
        <div className="relative flex-1 min-w-40">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
          </svg>
          <input
            type="text"
            placeholder="İsim ara…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Branş filtresi */}
        <select
          value={subject}
          onChange={e => setSubject(e.target.value)}
          className="text-sm border border-gray-200 dark:border-slate-600 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Tüm Branşlar</option>
          {uniqueSubjects.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        {/* Rol filtresi */}
        <select
          value={role}
          onChange={e => setRole(e.target.value)}
          className="text-sm border border-gray-200 dark:border-slate-600 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Tüm Roller</option>
          {Object.entries(ROLE_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>

        {/* A-Z sıralama */}
        <button
          onClick={() => setSortAsc(a => !a)}
          className="flex items-center gap-1 text-sm border border-gray-200 dark:border-slate-600 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
          title={sortAsc ? 'A→Z sıralı, değiştir' : 'Z→A sıralı, değiştir'}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
          </svg>
          {sortAsc ? 'A→Z' : 'Z→A'}
        </button>

        {/* Filtre temizle */}
        {hasFilter && (
          <button
            onClick={() => { setSearch(''); setSubject(''); setRole('') }}
            className="text-xs text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 transition-colors"
          >
            Temizle
          </button>
        )}
      </div>

      {/* Tablo */}
      <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-full">
            <thead className="bg-gray-50 dark:bg-slate-700 border-b border-gray-200 dark:border-slate-600">
              <tr>
                <th className="text-left px-3 py-2 sm:px-4 sm:py-3 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">Ad Soyad</th>
                <th className="text-left px-3 py-2 sm:px-4 sm:py-3 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide hidden sm:table-cell">Branş</th>
                <th className="text-left px-3 py-2 sm:px-4 sm:py-3 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">Rol</th>
                <th className="text-left px-3 py-2 sm:px-4 sm:py-3 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide hidden md:table-cell">Kullanım</th>
                <th className="px-3 py-2 sm:px-4 sm:py-3 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-400 dark:text-slate-500">
                    Sonuç bulunamadı.
                  </td>
                </tr>
              ) : filtered.map(u => {
                const isSelf      = u.id === currentUserId
                const canEditThis = canAssign && !isSelf && (
                  isMudur ? u.role !== 'mudur' : ['ogretmen', 'zumre_baskani'].includes(u.role)
                )
                const stats      = sessions[u.id]
                const totalHours = stats ? (stats.totalMinutes / 60).toFixed(1) : null

                return (
                  <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                    <td className="px-3 py-2 sm:px-4 sm:py-3">
                      <p className="font-medium text-gray-900 dark:text-slate-100">
                        {u.full_name}
                        {isSelf && <span className="ml-2 text-[10px] text-gray-400">(sen)</span>}
                      </p>
                    </td>
                    <td className="px-3 py-2 sm:px-4 sm:py-3 text-gray-500 dark:text-slate-400 hidden sm:table-cell">
                      {u.subject ?? '—'}
                    </td>
                    <td className="px-3 py-2 sm:px-4 sm:py-3">
                      {canEditThis ? (
                        <RoleSelector userId={u.id} currentRole={u.role} assignableRoles={assignableRoles} />
                      ) : (
                        <span className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full ${ROLE_BADGE[u.role] ?? ROLE_BADGE.ogretmen}`}>
                          {ROLE_LABELS[u.role] ?? u.role}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 sm:px-4 sm:py-3 hidden md:table-cell">
                      {stats ? (
                        <div>
                          <p className="text-xs font-medium text-gray-900 dark:text-slate-100">{stats.count} giriş · {totalHours} saat</p>
                          {stats.lastSeen && (
                            <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-0.5">
                              Son: {new Date(stats.lastSeen).toLocaleDateString('tr-TR')}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 sm:px-4 sm:py-3">
                      {canAssign && !isSelf && (
                        isMudur
                          ? u.role !== 'mudur'
                          : ['zumre_baskani', 'ogretmen'].includes(u.role)
                      ) && (
                        <DeleteButton userId={u.id} userName={u.full_name} />
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-gray-400 dark:text-slate-500">
        {filtered.length} / {users.length} kullanıcı gösteriliyor
      </p>
    </div>
  )
}
