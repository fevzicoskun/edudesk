'use client'

import { useState, useMemo } from 'react'
import { format, parseISO } from '@/src/shared/date'

const ACTION_LABELS: Record<string, string> = {
  'login':             'Sisteme giriş yapıldı',
  'logout':            'Sistemden çıkış yapıldı',
  'class.create':      'Sınıf oluşturuldu',
  'class.delete':      'Sınıf silindi',
  'class.restore':     'Sınıf geri yüklendi',
  'student.create':    'Öğrenci eklendi',
  'student.delete':    'Öğrenci silindi',
  'student.restore':   'Öğrenci geri yüklendi',
  'homework.create':   'Ödev oluşturuldu',
  'homework.delete':   'Ödev silindi',
  'homework.restore':  'Ödev geri yüklendi',
  'meeting.create':    'Toplantı oluşturuldu',
  'meeting.update':    'Toplantı güncellendi',
  'meeting.delete':    'Toplantı silindi',
  'meeting.restore':   'Toplantı geri yüklendi',
  'exam.create':       'Sınav oluşturuldu',
  'exam.delete':       'Sınav silindi',
  'exam.restore':      'Sınav geri yüklendi',
  'attendance.save':   'Yoklama kaydedildi',
  'profile.update':    'Profil bilgileri güncellendi',
  'password.change':   'Şifre değiştirildi',
  'token.generate':    'Veli erişim linki oluşturuldu',
  'token.revoke':      'Veli erişim linki kapatıldı',
  'role.assign':       'Kullanıcı rolü değiştirildi',
  'user.invite':       'Kullanıcı davet edildi',
  'user.remove':       'Kullanıcı kaldırıldı',
}

const TABLE_LABELS: Record<string, string> = {
  'classes':          'Sınıflar',
  'students':         'Öğrenciler',
  'homeworks':        'Ödevler',
  'homework_submissions': 'Ödev Teslimler',
  'attendance':       'Yoklama',
  'zumre_meetings':   'Zümre Toplantıları',
  'common_exams':     'Ortak Sınavlar',
  'profiles':         'Kullanıcı Profilleri',
  'user_sessions':    'Oturum Kayıtları',
  'revoked_tokens':   'Kapatılan Linkler',
  'veli_tokens':      'Veli Linkleri',
  'audit_logs':       'Denetim Kayıtları',
  'schools':          'Okul Bilgileri',
}

const CATEGORY_FILTERS = [
  { value: '',           label: 'Tüm işlemler' },
  { value: 'create',     label: 'Oluşturma' },
  { value: 'delete',     label: 'Silme' },
  { value: 'restore',    label: 'Geri Yükleme' },
  { value: 'update',     label: 'Güncelleme' },
  { value: 'token',      label: 'Veli Linkleri' },
  { value: 'login',      label: 'Giriş / Çıkış' },
  { value: 'attendance', label: 'Yoklama' },
]

const ACTION_COLOR: Record<string, string> = {
  delete:  'text-red-600   bg-red-50   border-red-100   dark:bg-red-950/40   dark:text-red-300   dark:border-red-900',
  restore: 'text-blue-600  bg-blue-50  border-blue-100  dark:bg-blue-950/40  dark:text-blue-300  dark:border-blue-900',
  create:  'text-green-700 bg-green-50 border-green-100 dark:bg-green-950/40 dark:text-green-300 dark:border-green-900',
  update:  'text-violet-600 bg-violet-50 border-violet-100 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-900',
  token:   'text-orange-600 bg-orange-50 border-orange-100 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-900',
  default: 'text-gray-600  bg-gray-50  border-gray-100  dark:bg-slate-700    dark:text-slate-300  dark:border-slate-600',
}

function actionColor(action: string): string {
  if (action.includes('restore')) return ACTION_COLOR.restore
  if (action.includes('token'))   return ACTION_COLOR.token
  if (action.includes('delete'))  return ACTION_COLOR.delete
  if (action.includes('create'))  return ACTION_COLOR.create
  if (action.includes('update') || action.includes('change') || action.includes('assign')) return ACTION_COLOR.update
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

const IGNORED_DATA_KEYS = new Set(['school_id', 'id', 'created_at', 'updated_at', 'deleted_at', 'deleted_by'])

function formatDataPreview(data: Record<string, unknown>): string {
  return Object.entries(data)
    .filter(([k]) => !IGNORED_DATA_KEYS.has(k))
    .slice(0, 3)
    .map(([, v]) => String(v ?? '').slice(0, 40))
    .filter(Boolean)
    .join(' · ')
}

export default function AuditLogClient({ logs, profiles }: { logs: Log[]; profiles: Profile[] }) {
  const profileMap = useMemo(() => new Map(profiles.map(p => [p.id, p.full_name ?? 'Bilinmeyen'])), [profiles])

  const [userId,   setUserId]   = useState('')
  const [category, setCategory] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo,   setDateTo]   = useState('')

  const filtered = useMemo(() => {
    return logs.filter(log => {
      if (userId   && log.user_id !== userId)           return false
      if (category && !log.action.includes(category))   return false
      if (dateFrom && log.created_at < dateFrom)        return false
      if (dateTo   && log.created_at.split('T')[0] > dateTo) return false
      return true
    })
  }, [logs, userId, category, dateFrom, dateTo])

  const hasFilter = !!(userId || category || dateFrom || dateTo)

  return (
    <section>
      <div className="mb-4 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-base font-bold text-gray-900 dark:text-slate-100">İşlem Geçmişi</h2>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
            {filtered.length} / {logs.length} kayıt gösteriliyor
          </p>
        </div>
        {hasFilter && (
          <button
            onClick={() => { setUserId(''); setCategory(''); setDateFrom(''); setDateTo('') }}
            className="text-xs text-purple-600 hover:underline font-medium"
          >
            Filtreleri temizle
          </button>
        )}
      </div>

      {/* Filtreler */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
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
          {CATEGORY_FILTERS.map(c => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>

        <input
          type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
          className="text-xs border border-gray-200 dark:border-slate-600 rounded-lg px-2.5 py-2 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-purple-500"
        />
        <input
          type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
          className="text-xs border border-gray-200 dark:border-slate-600 rounded-lg px-2.5 py-2 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-purple-500"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-center text-gray-400 text-sm py-12">
          {hasFilter ? 'Filtreyle eşleşen kayıt bulunamadı.' : 'Henüz kayıt yok.'}
        </p>
      ) : (
        <div className="space-y-1.5">
          {filtered.map(log => {
            const dataPreview = log.new_data ? formatDataPreview(log.new_data) : ''
            return (
              <div
                key={log.id}
                className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-semibold border rounded-full px-2 py-0.5 ${actionColor(log.action)}`}>
                      {ACTION_LABELS[log.action] ?? log.action}
                    </span>
                    {log.table_name && TABLE_LABELS[log.table_name] && (
                      <span className="text-xs text-gray-400 dark:text-slate-500">
                        {TABLE_LABELS[log.table_name]}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                    <span className="font-medium text-gray-700 dark:text-slate-300">{profileMap.get(log.user_id) ?? 'Bilinmeyen'}</span>
                    {dataPreview && <span className="ml-2 text-gray-400 dark:text-slate-500">· {dataPreview}</span>}
                  </p>
                </div>
                <p className="text-xs text-gray-400 dark:text-slate-500 shrink-0 tabular-nums">
                  {format(parseISO(log.created_at), 'd MMM yyyy HH:mm')}
                </p>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
