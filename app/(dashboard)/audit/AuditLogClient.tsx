'use client'

import { useState, useMemo } from 'react'
import { format, parseISO } from '@/src/shared/date'

const ACTION_LABELS: Record<string, string> = {
  'class.create':    'Sınıf oluşturuldu',
  'class.delete':    'Sınıf silindi',
  'student.create':  'Öğrenci eklendi',
  'student.delete':  'Öğrenci silindi',
  'homework.create': 'Ödev oluşturuldu',
  'homework.delete': 'Ödev silindi',
  'meeting.create':  'Toplantı oluşturuldu',
  'meeting.update':  'Toplantı güncellendi',
  'meeting.delete':  'Toplantı silindi',
  'exam.create':     'Sınav oluşturuldu',
  'exam.delete':     'Sınav silindi',
  'attendance.save': 'Yoklama kaydedildi',
  'profile.update':  'Profil güncellendi',
  'password.change': 'Şifre değiştirildi',
  'login':           'Giriş yapıldı',
  'logout':          'Çıkış yapıldı',
  'token.revoke':    'Link iptal edildi',
  'token.generate':  'Veli linki oluşturuldu',
}

const ACTION_CATEGORIES = [
  { value: '',        label: 'Tüm işlemler' },
  { value: 'create',  label: 'Oluşturma' },
  { value: 'delete',  label: 'Silme' },
  { value: 'update',  label: 'Güncelleme' },
  { value: 'token',   label: 'Link/Token' },
  { value: 'login',   label: 'Giriş/Çıkış' },
  { value: 'attendance', label: 'Yoklama' },
]

const ACTION_COLOR: Record<string, string> = {
  delete:  'text-red-600   bg-red-50   border-red-100   dark:bg-red-950/40   dark:text-red-300   dark:border-red-900',
  create:  'text-green-700 bg-green-50 border-green-100 dark:bg-green-950/40 dark:text-green-300 dark:border-green-900',
  update:  'text-blue-600  bg-blue-50  border-blue-100  dark:bg-blue-950/40  dark:text-blue-300  dark:border-blue-900',
  token:   'text-orange-600 bg-orange-50 border-orange-100 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-900',
  default: 'text-gray-600  bg-gray-50  border-gray-100  dark:bg-slate-700    dark:text-slate-300  dark:border-slate-600',
}

function actionColor(action: string): string {
  if (action.includes('token'))   return ACTION_COLOR.token
  if (action.includes('delete'))  return ACTION_COLOR.delete
  if (action.includes('create'))  return ACTION_COLOR.create
  if (action.includes('update') || action.includes('change')) return ACTION_COLOR.update
  return ACTION_COLOR.default
}

type Log = {
  id: string
  created_at: string
  action: string
  table_name: string | null
  record_id: string | null
  new_data: Record<string, unknown> | null
  user_id: string
}

type Profile = { id: string; full_name: string | null }

export default function AuditLogClient({ logs, profiles }: { logs: Log[]; profiles: Profile[] }) {
  const profileMap = useMemo(() => new Map(profiles.map(p => [p.id, p.full_name ?? 'Bilinmeyen'])), [profiles])

  const [userId,    setUserId]    = useState('')
  const [category,  setCategory]  = useState('')
  const [tableName, setTableName] = useState('')
  const [dateFrom,  setDateFrom]  = useState('')
  const [dateTo,    setDateTo]    = useState('')

  const tables = useMemo(() => {
    const set = new Set(logs.map(l => l.table_name).filter(Boolean) as string[])
    return [...set].sort()
  }, [logs])

  const filtered = useMemo(() => {
    return logs.filter(log => {
      if (userId    && log.user_id !== userId) return false
      if (tableName && log.table_name !== tableName) return false
      if (category  && !log.action.includes(category)) return false
      if (dateFrom  && log.created_at < dateFrom) return false
      if (dateTo    && log.created_at.split('T')[0] > dateTo) return false
      return true
    })
  }, [logs, userId, tableName, category, dateFrom, dateTo])

  const hasFilter = !!(userId || category || tableName || dateFrom || dateTo)

  function clearFilters() {
    setUserId(''); setCategory(''); setTableName(''); setDateFrom(''); setDateTo('')
  }

  return (
    <section>
      <div className="mb-4 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-base font-bold text-gray-900 dark:text-slate-100">Denetim Günlüğü</h2>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
            {filtered.length} / {logs.length} kayıt gösteriliyor
          </p>
        </div>
        {hasFilter && (
          <button
            onClick={clearFilters}
            className="text-xs text-purple-600 hover:underline font-medium"
          >
            Filtreleri temizle
          </button>
        )}
      </div>

      {/* Filtreler */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 mb-4">
        <select
          value={userId} onChange={e => setUserId(e.target.value)}
          className="text-xs border border-gray-200 dark:border-slate-600 rounded-lg px-2.5 py-2 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-purple-500"
        >
          <option value="">Tüm kullanıcılar</option>
          {profiles.map(p => (
            <option key={p.id} value={p.id}>{p.full_name ?? p.id.slice(0, 8)}</option>
          ))}
        </select>

        <select
          value={category} onChange={e => setCategory(e.target.value)}
          className="text-xs border border-gray-200 dark:border-slate-600 rounded-lg px-2.5 py-2 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-purple-500"
        >
          {ACTION_CATEGORIES.map(c => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>

        <select
          value={tableName} onChange={e => setTableName(e.target.value)}
          className="text-xs border border-gray-200 dark:border-slate-600 rounded-lg px-2.5 py-2 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-purple-500"
        >
          <option value="">Tüm tablolar</option>
          {tables.map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        <input
          type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
          placeholder="Başlangıç"
          className="text-xs border border-gray-200 dark:border-slate-600 rounded-lg px-2.5 py-2 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-purple-500"
        />

        <input
          type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
          placeholder="Bitiş"
          className="text-xs border border-gray-200 dark:border-slate-600 rounded-lg px-2.5 py-2 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-purple-500"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-center text-gray-400 text-sm py-12">
          {hasFilter ? 'Filtreyle eşleşen kayıt bulunamadı.' : 'Henüz kayıt yok.'}
        </p>
      ) : (
        <div className="space-y-2">
          {filtered.map(log => (
            <div
              key={log.id}
              className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs font-semibold border rounded-full px-2 py-0.5 ${actionColor(log.action)}`}>
                    {ACTION_LABELS[log.action] ?? log.action}
                  </span>
                  {log.table_name && (
                    <span className="text-xs text-gray-400 dark:text-slate-500">{log.table_name}</span>
                  )}
                </div>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                  {profileMap.get(log.user_id) ?? 'Bilinmeyen'}
                  {log.new_data && Object.keys(log.new_data).length > 0 && (
                    <span className="ml-2 text-gray-400 dark:text-slate-500">
                      · {Object.entries(log.new_data).slice(0, 3).map(([k, v]) => `${k}: ${v}`).join(', ')}
                    </span>
                  )}
                </p>
              </div>
              <p className="text-xs text-gray-400 dark:text-slate-500 shrink-0 tabular-nums">
                {format(parseISO(log.created_at), 'd MMM yyyy HH:mm')}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
