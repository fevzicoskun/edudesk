import { createClient } from '@/src/infrastructure/supabase/server'
import { getCurrentProfile } from '@/src/shared/auth'
import { isMudurOrAbove } from '@/src/shared/types'
import { redirect } from 'next/navigation'
import HomeworkForm, { type Defaults } from './HomeworkForm'
import Link from 'next/link'

export default async function YeniOdevPage({
  searchParams,
}: {
  searchParams: Promise<{ copy?: string; template?: string; templateSaved?: string }>
}) {
  const profile = await getCurrentProfile()
  if (!profile?.school_id) redirect('/anasayfa')
  if (isMudurOrAbove(profile.role)) redirect('/odevler')

  const { copy, template, templateSaved } = await searchParams

  const supabase = await createClient()
  const [classesRes, sourcesRes, templatesRes] = await Promise.all([
    supabase
      .from('classes')
      .select('id, name, grade')
      .eq('school_id', profile.school_id)
      .is('deleted_at', null)
      .order('grade')
      .order('name'),
    supabase
      .from('homework_sources')
      .select('id, name, subject')
      .eq('teacher_id', profile?.id ?? '')
      .eq('school_id', profile?.school_id ?? '')
      .eq('active', true)
      .order('name'),
    supabase
      .from('homeworks')
      .select('id, title, subject, class_id, description, source_id, classes(name)')
      .eq('teacher_id', profile?.id ?? '')
      .eq('school_id', profile?.school_id ?? '')
      .eq('is_template', true)
      .is('deleted_at', null)
      .order('title'),
  ])

  let defaults: Defaults | undefined

  if (template) {
    const { data: tmpl } = await supabase
      .from('homeworks')
      .select('title, subject, description, class_id, source_id')
      .eq('id', template)
      .eq('school_id', profile?.school_id ?? '')
      .eq('is_template', true)
      .is('deleted_at', null)
      .single()
    if (tmpl) {
      defaults = {
        title: tmpl.title,
        subject: tmpl.subject ?? '',
        description: tmpl.description,
        class_id: tmpl.class_id,
        source_id: tmpl.source_id,
        fromTemplate: true,
      }
    }
  } else if (copy) {
    const { data: original } = await supabase
      .from('homeworks')
      .select('title, subject, description, source_id')
      .eq('id', copy)
      .eq('school_id', profile?.school_id ?? '')
      .is('deleted_at', null)
      .single()
    if (original) {
      defaults = {
        title: `${original.title} (Kopya)`,
        subject: original.subject ?? '',
        description: original.description,
        source_id: original.source_id,
      }
    }
  }

  const templates = (templatesRes.data ?? []).map(t => ({
    id: t.id as string,
    title: t.title as string,
    subject: (t.subject ?? '') as string,
    class_id: t.class_id as string,
    classes: Array.isArray(t.classes) ? (t.classes[0] ?? null) as { name: string } | null : t.classes as { name: string } | null,
  }))

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
            <h1 className="text-base font-bold text-gray-900 leading-tight">
              {defaults?.fromTemplate ? 'Şablondan Ödev' : defaults ? 'Ödev Kopyala' : 'Ödev Oluştur'}
            </h1>
            <p className="text-xs text-gray-500">
              {defaults?.fromTemplate
                ? 'Tarihi seçin ve kaydedin'
                : defaults
                  ? 'Sınıf ve tarihi seçerek kopyayı kaydedin'
                  : 'Sınıfınıza yeni bir görev tanımlayın'}
            </p>
          </div>
        </div>

        {/* Şablonlar — sadece yeni ödev oluştururken göster */}
        {!defaults && templates.length > 0 && (
          <div className="mb-6 bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-gray-50/70">
              <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
              </svg>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Şablonlardan Oluştur</p>
            </div>
            <div className="divide-y divide-gray-50">
              {templates.map(tmpl => (
                <Link
                  key={tmpl.id}
                  href={`/odevler/yeni?template=${tmpl.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-blue-50/40 transition-colors group"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate group-hover:text-blue-700 transition-colors">
                      {tmpl.title}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {tmpl.subject}{tmpl.classes?.name ? ` · ${tmpl.classes.name}` : ''}
                    </p>
                  </div>
                  <svg className="w-4 h-4 text-gray-300 group-hover:text-blue-400 shrink-0 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              ))}
            </div>
          </div>
        )}

        {templateSaved && (
          <div className="mb-5 flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-3.5 text-sm text-emerald-800 dark:bg-emerald-950/20 dark:border-emerald-800 dark:text-emerald-300">
            <svg className="w-5 h-5 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Şablon kaydedildi. Yukarıdaki listeden seçerek yeni ödev oluşturabilirsiniz.</span>
          </div>
        )}

        <HomeworkForm
          classes={classesRes.data ?? []}
          sources={sourcesRes.data ?? []}
          defaults={defaults}
        />
      </div>
    </div>
  )
}
