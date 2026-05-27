// app/(dashboard)/profil/dosyam/page.tsx
import { getCurrentProfile } from '@/src/shared/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { InspectionService } from '@/src/domains/inspection/services/InspectionService'
import { createClient }      from '@/src/infrastructure/supabase/server'
import DosyamPdfButton, { type DosyamPdfData } from './DosyamPdfButton'

function getCurrentAcademicYear(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const start = month >= 9 ? year : year - 1
  return `${start}-${start + 1}`
}

function getTermStart(): string {
  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()
  return month >= 9
    ? `${year}-09-01`
    : `${year - 1}-09-01`
}

export default async function DosyamPage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')

  const supabase = await createClient()
  const academicYear = getCurrentAcademicYear()
  const termStart    = getTermStart()

  const [
    { count: zumreCount },
    { count: examCount },
    { data: dailyPlansRaw },
    { data: annualPlanRaw },
    { data: zumreMeetingsRaw },
    { data: commonExamsRaw },
    { data: sokReportsRaw },
    { data: notebookChecksRaw },
  ] = await Promise.all([
    supabase.from('zumre_meetings').select('id', { count: 'exact', head: true }).eq('school_id', profile.school_id),
    supabase.from('common_exams').select('id', { count: 'exact', head: true }).eq('school_id', profile.school_id),
    supabase.from('daily_plans')
      .select('plan_date, topic, class_id, classes(name)')
      .eq('teacher_id', profile.id)
      .gte('plan_date', termStart)
      .is('deleted_at', null)
      .order('plan_date', { ascending: false }),
    supabase.from('annual_plans')
      .select('weekly_plan, approved_at')
      .eq('teacher_id', profile.id)
      .eq('academic_year', academicYear)
      .maybeSingle(),
    supabase.from('zumre_meetings')
      .select('title, meeting_date')
      .order('meeting_date', { ascending: false }),
    supabase.from('common_exams')
      .select('title, exam_date, subject')
      .order('exam_date', { ascending: false }),
    supabase.from('sok_reports')
      .select('meeting_date, term, academic_year, class_id, classes(name)')
      .eq('teacher_id', profile.id)
      .is('deleted_at', null)
      .order('meeting_date', { ascending: false }),
    supabase.from('notebook_checks')
      .select('check_date, class_id, classes(name)')
      .eq('teacher_id', profile.id)
      .order('check_date', { ascending: false }),
  ])

  const status = await InspectionService.getCompletionStatus({
    zumreCount: zumreCount ?? 0,
    examCount:  examCount  ?? 0,
  })

  const missingDocs = [
    !status.dailyPlans     && 'Günlük Planlar',
    !status.annualPlan     && 'Yıllık Plan',
    !status.zumreMeetings  && 'Zümre Toplantıları',
    !status.commonExams    && 'Yazılı Sınavlar',
    !status.sokReports     && 'ŞÖK Tutanakları',
    !status.notebookChecks && 'Defter Kontrolü',
  ].filter(Boolean) as string[]

  const pdfData: DosyamPdfData = {
    teacherName:   profile.full_name ?? 'Öğretmen',
    schoolName:    profile.schools?.name ?? '',
    subject:       profile.subject ?? '',
    academicYear,
    annualPlan:    annualPlanRaw ?? null,
    dailyPlans:    (dailyPlansRaw ?? []).map((p: any) => ({
      plan_date: p.plan_date,
      topic:     p.topic,
      className: p.classes?.name ?? '',
    })),
    zumreMeetings: (zumreMeetingsRaw ?? []).map((m: any) => ({
      title:        m.title,
      meeting_date: m.meeting_date,
    })),
    commonExams: (commonExamsRaw ?? []).map((e: any) => ({
      title:     e.title,
      exam_date: e.exam_date,
      subject:   e.subject,
    })),
    sokReports: (sokReportsRaw ?? []).map((s: any) => ({
      meeting_date:  s.meeting_date,
      term:          s.term,
      academic_year: s.academic_year,
      className:     s.classes?.name ?? '',
    })),
    notebookChecks: (notebookChecksRaw ?? []).map((n: any) => ({
      check_date: n.check_date,
      className:  n.classes?.name ?? '',
    })),
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <div className="flex gap-1 border-b border-gray-200 mb-6">
        <Link
          href="/profil"
          className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700"
        >
          Profilim
        </Link>
        <span className="px-4 py-2 text-sm font-medium border-b-2 border-blue-600 text-blue-600">
          Dosyam
        </span>
      </div>

      <div className="bg-gradient-to-r from-blue-900 to-blue-700 rounded-xl p-5 text-white mb-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="font-bold">{profile.full_name} · {profile.subject ?? 'Öğretmen'}</div>
            <div className="text-xs opacity-75 mt-1">2025–2026 · Dönem Dosyası</div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-right">
              <div className="text-2xl font-extrabold">%{status.score}</div>
              <div className="text-xs opacity-75">dosya tamamlanma</div>
            </div>
            <DosyamPdfButton data={pdfData} />
          </div>
        </div>
        <div className="bg-white/20 rounded h-1.5 mb-3">
          <div
            className="bg-emerald-400 h-1.5 rounded transition-all"
            style={{ width: `${status.score}%` }}
          />
        </div>
        {missingDocs.length > 0 && (
          <div className="bg-red-500/80 rounded-lg px-3 py-2 text-xs inline-flex items-center gap-2">
            ⚠️ {missingDocs.length} eksik belge: <strong>{missingDocs.join(', ')}</strong>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <DocRow ok={status.dailyPlans}     icon="📋" title="Günlük Ders Planları"      href="/profil/dosyam/gunluk-plan"                newHref="/profil/dosyam/gunluk-plan/yeni" />
        <DocRow ok={status.annualPlan}     icon="📅" title="Yıllık Plan"               href="/profil/dosyam/yillik-plan" />
        <DocRow ok={status.zumreMeetings}  icon="👥" title="Zümre Toplantı Raporları"  href="/profil/dosyam/zumre-toplantilari" />
        <DocRow ok={status.commonExams}    icon="📝" title="Yazılı Sınavlar"           href="/profil/dosyam/yazili-sinavlar" />
        <DocRow ok={status.sokReports}     icon="📑" title="ŞÖK Tutanakları"           href="/profil/dosyam/sok"           newHref="/profil/dosyam/sok/yeni" />
        <DocRow ok={status.notebookChecks} icon="📓" title="Defter Kontrolü"           href="/profil/dosyam/defter-kontrolu" newHref="/profil/dosyam/defter-kontrolu" />
      </div>
    </div>
  )
}

function DocRow({
  ok, icon, title, href, newHref, external,
}: {
  ok:       boolean
  icon:     string
  title:    string
  href:     string
  newHref?: string
  external?: boolean
}) {
  return (
    <div className={`border rounded-lg px-3 py-2.5 flex items-center gap-3 ${ok ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}>
      <span className="text-xl">{icon}</span>
      <div className="flex-1">
        <div className={`text-sm font-bold ${ok ? 'text-emerald-800' : 'text-red-800'}`}>{title}</div>
        {!ok && <div className="text-xs text-red-500 mt-0.5">⚠️ Bu dönem kayıt yok</div>}
      </div>
      <div className="flex gap-1.5">
        {newHref && (
          <Link
            href={newHref}
            className={`text-xs rounded px-2 py-1 ${ok ? 'bg-emerald-600 text-white' : 'bg-red-500 text-white'}`}
          >
            + Yeni
          </Link>
        )}
        <Link
          href={href}
          className="text-xs bg-gray-100 text-gray-700 rounded px-2 py-1"
          {...(external ? { target: '_blank' } : {})}
        >
          {external ? 'Git →' : 'Listele'}
        </Link>
      </div>
    </div>
  )
}
