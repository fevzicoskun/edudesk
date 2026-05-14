import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile } from '@/lib/auth'
import { notFound } from 'next/navigation'
import { format, parseISO } from 'date-fns'
import { tr } from 'date-fns/locale'

export const revalidate = 0

const ACTION_LABELS: Record<string, string> = {
  'class.create': 'Sınıf oluşturuldu',
  'class.delete': 'Sınıf silindi',
  'student.create': 'Öğrenci eklendi',
  'student.delete': 'Öğrenci silindi',
  'homework.create': 'Ödev oluşturuldu',
  'homework.delete': 'Ödev silindi',
  'meeting.create': 'Toplantı oluşturuldu',
  'meeting.update': 'Toplantı güncellendi',
  'meeting.delete': 'Toplantı silindi',
  'exam.create': 'Sınav oluşturuldu',
  'exam.delete': 'Sınav silindi',
  'attendance.save': 'Yoklama kaydedildi',
  'profile.update': 'Profil güncellendi',
  'password.change': 'Şifre değiştirildi',
  'login': 'Giriş yapıldı',
  'logout': 'Çıkış yapıldı',
}

const ACTION_COLOR: Record<string, string> = {
  delete: 'text-red-600 bg-red-50 border-red-100',
  create: 'text-green-700 bg-green-50 border-green-100',
  update: 'text-blue-600 bg-blue-50 border-blue-100',
  default: 'text-gray-600 bg-gray-50 border-gray-100',
}

function actionColor(action: string) {
  if (action.includes('delete')) return ACTION_COLOR.delete
  if (action.includes('create')) return ACTION_COLOR.create
  if (action.includes('update')) return ACTION_COLOR.update
  return ACTION_COLOR.default
}

export default async function AuditPage() {
  const profile = await getCurrentProfile()
  if (profile?.role !== 'zumre_baskani') notFound()

  const supabase = await createClient()
  const { data: logs } = await supabase
    .from('audit_logs')
    .select('id, created_at, action, table_name, record_id, new_data, user_id')
    .order('created_at', { ascending: false })
    .limit(200)

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name')

  const profileMap = new Map((profiles ?? []).map(p => [p.id, p.full_name]))

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">Denetim Günlüğü</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">Son 200 işlem · Yalnızca Zümre Başkanı görebilir</p>
      </div>

      {!logs?.length ? (
        <p className="text-center text-gray-400 text-sm py-12">Henüz kayıt yok.</p>
      ) : (
        <div className="space-y-2">
          {logs.map(log => (
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
                  {profileMap.get(log.user_id) ?? 'Bilinmeyen kullanıcı'}
                  {log.new_data && Object.keys(log.new_data).length > 0 && (
                    <span className="ml-2 text-gray-400">
                      · {Object.entries(log.new_data).map(([k, v]) => `${k}: ${v}`).join(', ')}
                    </span>
                  )}
                </p>
              </div>
              <p className="text-xs text-gray-400 dark:text-slate-500 shrink-0">
                {format(parseISO(log.created_at), 'd MMM yyyy HH:mm', { locale: tr })}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
