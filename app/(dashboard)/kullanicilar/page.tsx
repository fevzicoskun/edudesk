import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile } from '@/lib/auth'
import { isMudurOrAbove, ROLE_LABELS, type Role } from '@/lib/types'
import RoleSelector from './RoleSelector'

export const revalidate = 0

type UserRow = {
  id: string
  full_name: string
  subject: string | null
  role: Role
}

const ROLE_BADGE: Record<Role, string> = {
  mudur:            'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300',
  mudur_yardimcisi: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300',
  zumre_baskani:    'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  ogretmen:         'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-300',
}

export default async function KullanicilarPage() {
  const profile = await getCurrentProfile()
  if (!profile || !isMudurOrAbove(profile.role)) redirect('/anasayfa')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data } = await supabase
    .from('profiles')
    .select('id, full_name, subject, role')
    .order('role')
    .order('full_name')

  const users = (data ?? []) as UserRow[]
  const canAssign = profile.role === 'mudur' || profile.role === 'mudur_yardimcisi'

  // Müdür yardımcısı mudur_yardimcisi atayamaz
  const assignableRoles = (profile.role === 'mudur'
    ? ['mudur_yardimcisi', 'zumre_baskani', 'ogretmen']
    : ['zumre_baskani', 'ogretmen']) as Role[]

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">Kullanıcılar</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
          {users.length} kullanıcı · okul geneli
        </p>
      </div>

      <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-slate-700 border-b border-gray-200 dark:border-slate-600">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">Ad Soyad</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide hidden sm:table-cell">Branş</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">Rol</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
            {users.map((u) => {
              const isSelf = u.id === user.id
              const canEditThis = canAssign && !isSelf && assignableRoles.includes(u.role)
              // mudur kendi rolünü ve diğer müdürü değiştiremez
              const editableRoles = assignableRoles.filter(r => r !== 'mudur' || profile.role === 'mudur')

              return (
                <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900 dark:text-slate-100">
                      {u.full_name}
                      {isSelf && <span className="ml-2 text-[10px] text-gray-400">(sen)</span>}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-slate-400 hidden sm:table-cell">
                    {u.subject ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    {canEditThis ? (
                      <RoleSelector
                        userId={u.id}
                        currentRole={u.role}
                        assignableRoles={editableRoles}
                      />
                    ) : (
                      <span className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full ${ROLE_BADGE[u.role] ?? ROLE_BADGE.ogretmen}`}>
                        {ROLE_LABELS[u.role] ?? u.role}
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
