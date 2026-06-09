import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/src/shared/auth'
import { createServiceClient } from '@/src/infrastructure/supabase/service'

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const supabase = createServiceClient()
  const { data } = await supabase
    .from('platform_admins')
    .select('id')
    .eq('id', user.id)
    .maybeSingle()

  if (!data) redirect('/anasayfa')

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center text-white font-bold text-sm">E</div>
          <div>
            <span className="font-semibold text-white">EduDesk</span>
            <span className="ml-2 text-xs bg-violet-900 text-violet-300 px-2 py-0.5 rounded-full">Platform Admin</span>
          </div>
        </div>
        <a href="/anasayfa" className="text-sm text-slate-400 hover:text-slate-200 transition-colors">
          ← Dashboard'a dön
        </a>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
    </div>
  )
}
