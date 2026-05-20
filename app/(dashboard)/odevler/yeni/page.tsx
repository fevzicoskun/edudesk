import { createClient } from '@/src/infrastructure/supabase/server'
import { getCurrentProfile } from '@/src/shared/auth'
import { isMudurOrAbove } from '@/src/shared/types'
import { redirect } from 'next/navigation'
import HomeworkForm from './HomeworkForm'
import Link from 'next/link'

export default async function YeniOdevPage() {
  const profile = await getCurrentProfile()
  if (profile && isMudurOrAbove(profile.role)) redirect('/odevler')

  const supabase = await createClient()
  const { data: classes } = await supabase
    .from('classes')
    .select('id, name, grade')
    .order('grade')
    .order('name')

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-50 via-red-50/20 to-slate-50">
      <div className="p-4 md:p-6 max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/odevler"
            className="flex items-center justify-center w-9 h-9 rounded-xl bg-white border border-gray-200 text-gray-500 hover:text-gray-800 hover:border-gray-300 shadow-sm hover:shadow transition-all duration-200"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-base font-bold text-gray-900 leading-tight">Ödev Oluştur</h1>
            <p className="text-xs text-gray-500">Sınıfınıza yeni bir görev tanımlayın</p>
          </div>
        </div>
        <HomeworkForm classes={classes ?? []} />
      </div>
    </div>
  )
}
