import { createClient } from '@/src/infrastructure/supabase/server'
import { getCurrentProfile } from '@/src/shared/auth'
import Link from 'next/link'

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  active:    { label: 'Aktif',    cls: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' },
  trial:     { label: 'Trial',    cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  suspended: { label: 'Askıda',   cls: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' },
  cancelled: { label: 'Kapalı',   cls: 'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-400' },
}

const PLAN_LABEL: Record<string, string> = {
  free:       'Ücretsiz',
  starter:    'Starter',
  pro:        'Pro',
  enterprise: 'Enterprise',
}

export default async function OkulBilgileri() {
  const [supabase, profile] = await Promise.all([createClient(), getCurrentProfile()])
  if (!profile?.school_id) return null

  const [schoolRes, teacherRes, studentRes] = await Promise.all([
    supabase
      .from('schools')
      .select('id, name, slug, status, plan, created_at, trial_ends_at')
      .eq('id', profile.school_id)
      .single(),
    supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('school_id', profile.school_id),
    supabase
      .from('students')
      .select('id', { count: 'exact', head: true })
      .eq('school_id', profile.school_id)
      .is('deleted_at', null),
  ])

  const school = schoolRes.data
  if (!school) return null

  const status = STATUS_LABEL[school.status ?? 'active'] ?? STATUS_LABEL.active
  const plan   = PLAN_LABEL[school.plan ?? 'free'] ?? school.plan ?? 'Ücretsiz'

  const createdYear = school.created_at
    ? new Date(school.created_at).getFullYear()
    : '—'

  return (
    <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-5 space-y-4">
      <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300">Okul Bilgileri</h2>

      {/* Okul özeti */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500 dark:text-slate-400">Okul adı</span>
          <span className="text-sm font-medium text-gray-900 dark:text-slate-100">{school.name}</span>
        </div>
        {school.slug && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500 dark:text-slate-400">Okul kodu</span>
            <span className="font-mono text-xs text-gray-600 dark:text-slate-400 bg-gray-100 dark:bg-slate-700 px-2 py-0.5 rounded">
              {school.slug}
            </span>
          </div>
        )}
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500 dark:text-slate-400">Plan</span>
          <span className="text-sm font-medium text-gray-900 dark:text-slate-100">{plan}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500 dark:text-slate-400">Durum</span>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${status.cls}`}>
            {status.label}
          </span>
        </div>
        {school.trial_ends_at && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500 dark:text-slate-400">Trial bitiş</span>
            <span className="text-sm text-amber-600 dark:text-amber-400">
              {new Date(school.trial_ends_at).toLocaleDateString('tr-TR')}
            </span>
          </div>
        )}
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500 dark:text-slate-400">Kayıt yılı</span>
          <span className="text-sm text-gray-700 dark:text-slate-300">{createdYear}</span>
        </div>
      </div>

      {/* Kullanım */}
      <div className="border-t border-gray-100 dark:border-slate-700 pt-3 grid grid-cols-2 gap-3">
        <div className="bg-gray-50 dark:bg-slate-900/50 rounded-lg px-3 py-2.5 text-center">
          <p className="text-lg font-bold text-gray-900 dark:text-slate-100">{teacherRes.count ?? '—'}</p>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">Öğretmen</p>
        </div>
        <div className="bg-gray-50 dark:bg-slate-900/50 rounded-lg px-3 py-2.5 text-center">
          <p className="text-lg font-bold text-gray-900 dark:text-slate-100">{studentRes.count ?? '—'}</p>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">Öğrenci</p>
        </div>
      </div>

      {/* KVKK / Veri silme */}
      <div className="border-t border-gray-100 dark:border-slate-700 pt-3 space-y-2">
        <h3 className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">
          Kişisel Veri & KVKK
        </h3>
        <p className="text-xs text-gray-500 dark:text-slate-400 leading-relaxed">
          6698 sayılı KVKK kapsamında kişisel verilerin işlenmesi, saklanması ve silinmesine dair bilgilere{' '}
          <Link href="/gizlilik" className="text-blue-600 dark:text-blue-400 hover:underline">
            Gizlilik Politikası
          </Link>{' '}
          sayfasından ulaşabilirsiniz.
        </p>
        <p className="text-xs text-gray-500 dark:text-slate-400 leading-relaxed">
          Okul verilerinin silinmesi veya aktarılması için{' '}
          <a
            href="mailto:destek@myedudesk.com.tr?subject=Veri%20Silme%20Talebi%20-%20EduDesk&body=Okul%20Adı%3A%20"
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            destek@myedudesk.com.tr
          </a>{' '}
          adresine yazılı talep gönderin. Talepler 30 gün içinde işleme alınır.
        </p>
      </div>
    </div>
  )
}
