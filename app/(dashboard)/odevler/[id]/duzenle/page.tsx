'use server'

import { createClient } from '@/src/infrastructure/supabase/server'
import { getCurrentProfile } from '@/src/shared/auth'
import { notFound, redirect } from 'next/navigation'
import { isTeachingRole } from '@/src/shared/types'
import Link from 'next/link'
import OdevDuzenleForm from './OdevDuzenleForm'

export default async function OdevDuzenle({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const profile = await getCurrentProfile()
  if (!profile?.school_id) redirect('/login')
  if (!isTeachingRole(profile.role)) redirect(`/odevler/${id}`)

  const supabase = await createClient()

  const [hwRes, sourcesRes] = await Promise.all([
    supabase
      .from('homeworks')
      .select('id, title, subject, description, due_date, teacher_id, source_id')
      .eq('id', id)
      .eq('school_id', profile.school_id)
      .is('deleted_at', null)
      .eq('is_template', false)
      .single(),
    supabase
      .from('homework_sources')
      .select('id, name, subject')
      .eq('teacher_id', profile.id)
      .eq('school_id', profile.school_id)
      .eq('active', true)
      .order('name'),
  ])

  const hw = hwRes.data
  if (!hw) notFound()
  if (hw.teacher_id !== profile.id) redirect(`/odevler/${id}`)

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-50 via-red-50/20 to-slate-50">
      <div className="p-4 md:p-6 max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Link
            href={`/odevler/${id}`}
            className="flex items-center justify-center w-9 h-9 rounded-xl bg-white border border-gray-200 text-gray-500 hover:text-gray-800 hover:border-gray-300 shadow-sm transition-all"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-base font-bold text-gray-900 leading-tight">Ödevi Düzenle</h1>
            <p className="text-xs text-gray-500">Sınıf değiştirilemez, teslim geçmişi korunur</p>
          </div>
        </div>

        <OdevDuzenleForm
          hw={{
            id: hw.id,
            title: hw.title,
            subject: hw.subject ?? '',
            description: hw.description,
            due_date: hw.due_date,
            source_id: hw.source_id,
          }}
          sources={sourcesRes.data ?? []}
        />
      </div>
    </div>
  )
}
