import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { addStudent, deleteStudent } from '@/src/domains/classes/actions'
import { getEgitimYili } from '@/lib/utils'
import { ConfirmDeleteButton } from '@/components/ConfirmDeleteButton'
import BulkStudentModal from './BulkStudentModal'

export default async function SinifDetayPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const [clsResult, studentsResult] = await Promise.all([
    supabase.from('classes').select('name').eq('id', id).single(),
    supabase
      .from('students')
      .select('id, full_name, student_number')
      .eq('class_id', id)
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

      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">{cls.name}</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400">{students.length} öğrenci · {egitimYili}</p>
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
        <div className="space-y-2">
          {students.map((s, i) => (
            <div
              key={s.id}
              className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-3 flex items-center gap-3"
            >
              <span className="text-xs text-gray-400 w-6 text-right shrink-0">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <Link
                  href={`/siniflar/${id}/ogrenciler/${s.id}`}
                  className="text-sm font-medium text-gray-900 dark:text-slate-100 hover:text-blue-700 dark:hover:text-blue-400"
                >
                  {s.full_name}
                </Link>
                {s.student_number && (
                  <p className="text-xs text-gray-400">No: {s.student_number}</p>
                )}
              </div>
              <ConfirmDeleteButton
                action={deleteStudent.bind(null, s.id, id)}
                message={`"${s.full_name}" adlı öğrenciyi ve tüm ödev kayıtlarını silmek istediğine emin misin?`}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
