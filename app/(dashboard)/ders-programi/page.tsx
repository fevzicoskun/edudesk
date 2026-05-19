import { createClient } from '@/lib/supabase/server'
import { getCurrentUser, getCurrentProfile } from '@/src/shared/auth'
import Link from 'next/link'
import DersProgramiListUI from './DersProgramiListUI'

type Teacher = { id: string; full_name: string | null; subject: string | null }
type Cls = { id: string; name: string; grade: number }
type Schedule = {
  id: string
  schedule_type: 'resmi' | 'okul'
  type_label: string
  teacher_id: string | null
  class_id: string | null
  file_url: string | null
  file_name: string | null
  created_at: string
  teacher: Teacher | null
  cls: Cls | null
}

export default async function DersProgramiPage() {
  const supabase = await createClient()
  const [user, profile] = await Promise.all([getCurrentUser(), getCurrentProfile()])
  if (!user || !profile) return null

  const [{ data: schedulesRaw }, { data: teachersRaw }, { data: classesRaw }] = await Promise.all([
    supabase
      .from('lesson_schedules')
      .select('id, schedule_type, type_label, teacher_id, class_id, file_url, file_name, created_at')
      .order('created_at', { ascending: false }),
    supabase
      .from('profiles')
      .select('id, full_name, subject')
      .eq('school_id', profile.school_id)
      .in('role', ['ogretmen', 'zumre_baskani'])
      .order('full_name'),
    supabase
      .from('classes')
      .select('id, name, grade')
      .eq('school_id', profile.school_id)
      .order('grade').order('name'),
  ])

  const teacherMap = new Map<string, Teacher>()
  ;(teachersRaw ?? []).forEach((t: Teacher) => teacherMap.set(t.id, t))

  const classMap = new Map<string, Cls>()
  ;(classesRaw ?? []).forEach((c: Cls) => classMap.set(c.id, c))

  const schedules: Schedule[] = (schedulesRaw ?? []).map((s: {
    id: string; schedule_type: 'resmi' | 'okul'; type_label: string;
    teacher_id: string | null; class_id: string | null;
    file_url: string | null; file_name: string | null; created_at: string
  }) => ({
    ...s,
    teacher: s.teacher_id ? teacherMap.get(s.teacher_id) ?? null : null,
    cls: s.class_id ? classMap.get(s.class_id) ?? null : null,
  }))

  const okulLabel = schedules.find(s => s.schedule_type === 'okul')?.type_label ?? 'Okul Programı'

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">Ders Programları</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">PDF veya resim olarak yüklenmiş haftalık programlar</p>
        </div>
        <Link
          href="/ders-programi/yeni"
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
          Yeni Program
        </Link>
      </div>

      <DersProgramiListUI schedules={schedules} okulLabel={okulLabel} />
    </div>
  )
}
