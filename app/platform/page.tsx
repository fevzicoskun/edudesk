import { createServiceClient } from '@/src/infrastructure/supabase/service'
import { Badge } from '@/components/ui/badge'
import NewSchoolModal from './NewSchoolModal'
import StatusToggle from './StatusToggle'
import CancelSchoolButton from './CancelSchoolButton'

const STATUS_LABELS: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  active:    { label: 'Aktif',     variant: 'default' },
  trial:     { label: 'Trial',     variant: 'secondary' },
  suspended: { label: 'Askıda',    variant: 'destructive' },
  cancelled: { label: 'Kapalı',    variant: 'outline' },
}

// Süper-admin paneli (platform_admins). Arama motorlarından gizli.
export const metadata = { title: 'Platform Yönetimi', robots: { index: false, follow: false } }

export default async function PlatformPage() {
  const supabase = createServiceClient()
  const { data: schools } = await supabase
    .from('tenant_metrics')
    .select('*')
    .order('created_at', { ascending: false })

  const totalTeachers  = schools?.reduce((s, r) => s + (r.teacher_count ?? 0), 0) ?? 0
  const totalStudents  = schools?.reduce((s, r) => s + (r.student_count ?? 0), 0) ?? 0
  const activeSchools  = schools?.filter(r => r.status === 'active').length ?? 0

  return (
    <div className="space-y-8">
      {/* Başlık */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Okullar</h1>
          <p className="text-slate-400 text-sm mt-1">{schools?.length ?? 0} okul kayıtlı</p>
        </div>
        <NewSchoolModal />
      </div>

      {/* Özet kartlar */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Aktif Okul',    value: activeSchools,  color: 'text-violet-400' },
          { label: 'Öğretmen',      value: totalTeachers,  color: 'text-emerald-400' },
          { label: 'Öğrenci',       value: totalStudents,  color: 'text-sky-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-slate-900 border border-slate-800 rounded-xl px-5 py-4">
            <p className="text-slate-400 text-xs font-medium uppercase tracking-wide">{label}</p>
            <p className={`text-3xl font-bold mt-1 ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Okul listesi */}
      <div className="space-y-3">
        {!schools?.length && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center text-slate-500">
            Henüz okul yok. "Yeni Okul" ile başlayın.
          </div>
        )}
        {schools?.map((school) => {
          const status = STATUS_LABELS[school.status ?? 'active']
          return (
            <div key={school.school_id}
              className="bg-slate-900 border border-slate-800 rounded-xl px-6 py-5 flex items-center justify-between hover:border-slate-700 transition-colors">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center text-slate-300 font-bold text-sm shrink-0">
                  {school.school_name?.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-white">{school.school_name}</span>
                    <Badge variant={status.variant} className="text-[11px] px-1.5 py-0">{status.label}</Badge>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                    <span className="font-mono text-slate-400">{school.slug}</span>
                    <span>·</span>
                    <span>{school.teacher_count ?? 0} öğretmen</span>
                    <span>·</span>
                    <span>{school.student_count ?? 0} öğrenci</span>
                    <span>·</span>
                    <span>{school.class_count ?? 0} sınıf</span>
                    <span>·</span>
                    <span>{school.homework_count ?? 0} ödev</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {school.status !== 'cancelled' && (
                  <>
                    <StatusToggle schoolId={school.school_id!} current={(school.status ?? 'active') as 'active' | 'trial' | 'suspended'} />
                    <CancelSchoolButton schoolId={school.school_id!} schoolName={school.school_name ?? ''} />
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
