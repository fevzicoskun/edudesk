import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import YoklamaBoard from './YoklamaBoard'
import type { AttendanceStatus } from '@/app/actions/yoklama'

export const revalidate = 0

const MIGRATION_SQL = `CREATE TABLE IF NOT EXISTS attendance (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id UUID NOT NULL REFERENCES profiles(id),
  class_id   UUID NOT NULL REFERENCES classes(id),
  student_id UUID NOT NULL REFERENCES students(id),
  date       DATE NOT NULL,
  status     TEXT NOT NULL DEFAULT 'present'
               CHECK (status IN ('present', 'absent', 'late', 'excused')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (class_id, student_id, date)
);
CREATE INDEX IF NOT EXISTS idx_attendance_class_date ON attendance(class_id, date);
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "attendance_own" ON attendance FOR ALL TO authenticated
  USING (auth.uid() = teacher_id) WITH CHECK (auth.uid() = teacher_id);`

export default async function YoklamaPage({
  searchParams,
}: {
  searchParams: Promise<{ classId?: string }>
}) {
  const { classId } = await searchParams
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const supabase = await createClient()
  const today = new Date().toISOString().split('T')[0]

  const { data: classes } = await supabase
    .from('classes')
    .select('id, name, grade')
    .order('grade')
    .order('name')

  const selectedId = classId ?? classes?.[0]?.id
  const selectedClass = classes?.find(c => c.id === selectedId)

  let tableExists = true
  let students: { id: string; full_name: string; student_number: string | null }[] = []
  let existing: Record<string, AttendanceStatus> = {}

  if (selectedId) {
    const [studentsRes, attendanceRes] = await Promise.all([
      supabase
        .from('students')
        .select('id, full_name, student_number')
        .eq('class_id', selectedId)
        .order('student_number', { nullsFirst: false })
        .order('full_name'),
      supabase
        .from('attendance')
        .select('student_id, status')
        .eq('class_id', selectedId)
        .eq('date', today),
    ])

    if (attendanceRes.error?.code === '42P01') {
      tableExists = false
    } else {
      students = studentsRes.data ?? []
      for (const r of attendanceRes.data ?? []) {
        existing[r.student_id] = r.status as AttendanceStatus
      }
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">Yoklama</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">Günlük öğrenci devam takibi</p>
      </div>

      {!tableExists ? (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-5">
          <h2 className="font-semibold text-yellow-800 dark:text-yellow-300 mb-2">Kurulum gerekiyor</h2>
          <p className="text-sm text-yellow-700 dark:text-yellow-400 mb-3">
            Yoklama tablosu henüz oluşturulmamış. Supabase Dashboard &rsaquo; SQL Editor'de aşağıdaki SQL'i çalıştır:
          </p>
          <pre className="bg-gray-900 text-green-400 text-xs p-4 rounded-lg overflow-x-auto whitespace-pre-wrap">
            {MIGRATION_SQL}
          </pre>
          <p className="text-xs text-yellow-600 dark:text-yellow-500 mt-3">
            Çalıştırdıktan sonra sayfayı yenile.
          </p>
        </div>
      ) : (
        <>
          {/* Sınıf seçimi */}
          <div className="flex flex-wrap gap-2 mb-5">
            {(classes ?? []).map(c => (
              <Link
                key={c.id}
                href={`/yoklama?classId=${c.id}`}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  c.id === selectedId
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:border-blue-300'
                }`}
              >
                {c.name}
              </Link>
            ))}
          </div>

          {selectedClass ? (
            <YoklamaBoard
              students={students}
              classId={selectedId!}
              className={selectedClass.name}
              todayStr={today}
              existing={existing}
            />
          ) : (
            <p className="text-center py-12 text-gray-400 text-sm">Sınıf seçin veya önce sınıf ekleyin.</p>
          )}
        </>
      )}
    </div>
  )
}
