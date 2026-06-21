import { Suspense } from 'react'
import { createClient } from '@/src/infrastructure/supabase/server'
import { getCurrentProfile, getCurrentUser } from '@/src/shared/auth'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import PrintButton from '@/components/PrintButton'
import { format, parseISO } from '@/src/shared/date'
import { isTeachingRole, isMudurOrAbove } from '@/src/shared/types'
import StatusBoardLoader from './StatusBoardLoader'

export const revalidate = 30

function StatusBoardSkeleton() {
  function Sk({ className }: { className?: string }) {
    return <div className={`bg-gray-200 dark:bg-slate-700 rounded-lg animate-pulse ${className ?? ''}`} />
  }
  return (
    <div className="space-y-2">
      <div className="flex gap-2 mb-3">
        <Sk className="h-8 w-20 rounded-full" />
        <Sk className="h-8 w-20 rounded-full" />
        <Sk className="h-8 w-20 rounded-full" />
      </div>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-2 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl">
          <Sk className="h-4 w-6 shrink-0" />
          <Sk className="h-4 flex-1" />
          <Sk className="h-8 w-28 rounded-lg" />
        </div>
      ))}
    </div>
  )
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const profile = await getCurrentProfile()
  if (!profile?.school_id) return { title: 'Ödev' }
  const supabase = await createClient()
  const { data } = await supabase
    .from('homeworks')
    .select('title')
    .eq('id', id)
    .eq('school_id', profile.school_id)
    .is('deleted_at', null)
    .single()
  return { title: data?.title ?? 'Ödev' }
}

export default async function OdevDetayPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ guncellendi?: string }>
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams])
  const [profile, user] = await Promise.all([getCurrentProfile(), getCurrentUser()])
  if (!profile?.school_id || !user) redirect('/login')

  const supabase = await createClient()

  const { data: hw } = await supabase
    .from('homeworks')
    .select('id, title, subject, description, due_date, class_id, teacher_id, is_template, classes(name)')
    .eq('id', id)
    .eq('school_id', profile.school_id)
    .is('deleted_at', null)
    .single()

  if (!hw || hw.is_template) notFound()

  // Yetki kontrolü önce — erişim yoksa loader'a gerek yok
  const isManager = profile.role === 'zumre_baskani' || isMudurOrAbove(profile.role)
  if (!isManager && hw.teacher_id !== user.id) notFound()

  const canWrite = isTeachingRole(profile.role)
  const cls = hw.classes as { name: string } | null

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      {/* Print başlığı */}
      <div className="hidden print:block mb-6 pb-4 border-b border-gray-300">
        <h1 className="text-xl font-bold text-gray-900">{hw.title}</h1>
        <p className="text-sm text-gray-600 mt-1">
          {cls?.name ?? '—'} · {hw.subject ?? ''}
          {hw.due_date ? ` · Son Teslim: ${format(parseISO(hw.due_date), 'd MMMM yyyy')}` : ''}
        </p>
        <p className="text-xs text-gray-400 mt-1">
          Yazdırma tarihi: {format(new Date(), 'd MMMM yyyy')}
        </p>
      </div>
      {sp.guncellendi && (
        <div className="mb-4 flex items-center gap-2 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-300 text-sm px-4 py-3 rounded-xl print:hidden">
          <svg className="w-4 h-4 text-green-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          Ödev başarıyla güncellendi.
        </div>
      )}
      <div className="flex items-center justify-between mb-3 print:hidden">
        <Link href="/odevler" className="text-sm text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200">
          ← Ödevler
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href={`/odevler/sinif/${hw.class_id}`}
            className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 px-2.5 py-1.5 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 14h18M10 3v18M14 3v18" />
            </svg>
            Başarı Haritası
          </Link>
          {canWrite && (
            <>
              <Link
                href={`/odevler/${id}/duzenle`}
                className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 px-2.5 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Düzenle
              </Link>
              <Link
                href={`/odevler/yeni?copy=${id}`}
                className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 px-2.5 py-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Kopyala
              </Link>
            </>
          )}
          <PrintButton />
        </div>
      </div>

      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">{hw.title}</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
          {cls?.name ?? '—'} · {hw.subject}
          {hw.due_date ? ` · Son: ${format(parseISO(hw.due_date), 'd MMMM yyyy')}` : ''}
        </p>
        {hw.description && (
          <p className="text-sm text-gray-700 dark:text-slate-300 mt-3 bg-gray-50 dark:bg-slate-800 rounded-xl p-3 border border-gray-200 dark:border-slate-700">
            {hw.description}
          </p>
        )}
      </div>

      <Suspense fallback={<StatusBoardSkeleton />}>
        <StatusBoardLoader
          homeworkId={id}
          classId={hw.class_id}
          dueDate={hw.due_date ?? null}
          schoolId={profile.school_id}
          homeworkTitle={hw.title}
          className={cls?.name}
        />
      </Suspense>
    </div>
  )
}
