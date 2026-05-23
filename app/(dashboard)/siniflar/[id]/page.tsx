import { createClient } from '@/src/infrastructure/supabase/server'
import { getCurrentProfile } from '@/src/shared/auth'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { addStudent } from '@/src/domains/classes/actions'
import { getEgitimYili } from '@/src/shared/utils'
import BulkStudentModal from './BulkStudentModal'
import SinifExportButton from './SinifExportButton'
import OgrenciListesi from './OgrenciListesi'

export default async function SinifDetayPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [supabase, profile] = await Promise.all([createClient(), getCurrentProfile()])

  const schoolId = profile?.school_id ?? ''

  const [clsResult, studentsResult] = await Promise.all([
    supabase
      .from('classes')
      .select('name')
      .eq('id', id)
      .eq('school_id', schoolId)
      .single(),
    supabase
      .from('students')
      .select('id, full_name, student_number')
      .eq('class_id', id)
      .eq('school_id', schoolId)
      .is('deleted_at', null)
      .order('student_number', { nullsFirst: false })
      .order('full_name'),
  ])

  if (!clsResult.data) notFound()

  const cls = clsResult.data
  const students = studentsResult.data ?? []
  const egitimYili = getEgitimYili()

  const maxNumber = students.reduce((max, s) => {
    const n = parseInt(s.student_number ?? '', 10)
    return isNaN(n) ? max : Math.max(max, n)
  }, 0)

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <Link href="/siniflar" className="text-sm text-gray-500 hover:text-gray-700 mb-3 inline-block">
        ← Sınıflar
      </Link>

      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">{cls.name}</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400">{students.length} öğrenci · {egitimYili}</p>
        </div>
        <SinifExportButton classId={id} className={cls.name} />
      </div>

      <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-5 mb-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300">Öğrenci Ekle</h2>
          <BulkStudentModal classId={id} maxNumber={maxNumber} />
        </div>
        <form action={addStudent.bind(null, id)} className="flex gap-2 flex-wrap">
          <input
            name="full_name"
            type="text"
            required
            placeholder="Ad Soyad"
            className="flex-1 min-w-40 px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            name="student_number"
            type="text"
            placeholder="Numara"
            className="px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm w-24 bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            Ekle
          </button>
        </form>
      </div>

      {students.length === 0 ? (
        <div className="text-center py-20 text-gray-400 text-sm">Bu sınıfta henüz öğrenci yok.</div>
      ) : (
        <OgrenciListesi
          students={students}
          classId={id}
          canDelete={profile?.role === 'mudur' || profile?.role === 'mudur_yardimcisi'}
        />
      )}
    </div>
  )
}
