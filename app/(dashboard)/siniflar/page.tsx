import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { createClass, deleteClass } from '@/app/actions/class'
import { getEgitimYili } from '@/lib/utils'
import { ConfirmDeleteButton } from '@/components/ConfirmDeleteButton'

export default async function SiniflarPage() {
  const supabase = await createClient()

  const { data: classes } = await supabase
    .from('classes')
    .select('id, name, grade, students(id)')
    .order('grade')
    .order('name')

  const egitimYili = getEgitimYili()

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-900">Sınıflar</h1>
        <p className="text-sm text-gray-500 mt-0.5">{egitimYili} Eğitim Yılı</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Yeni Sınıf Ekle</h2>
        <form action={createClass} className="flex gap-2 flex-wrap">
          <input
            name="name"
            type="text"
            required
            placeholder="9-A"
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            name="grade"
            type="number"
            required
            placeholder="Sınıf (9)"
            min="1"
            max="12"
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm w-28 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            Ekle
          </button>
        </form>
      </div>

      {!classes?.length ? (
        <div className="text-center py-20 text-gray-400 text-sm">Henüz sınıf eklenmemiş.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {classes.map((c) => {
            const studentCount = Array.isArray(c.students) ? c.students.length : 0
            return (
              <div
                key={c.id}
                className="bg-white border border-gray-200 rounded-xl p-5 hover:border-blue-300 hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between gap-2">
                  <Link href={`/siniflar/${c.id}`} className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900 text-lg">{c.name}</p>
                    <p className="text-sm text-gray-500 mt-0.5">{studentCount} öğrenci</p>
                  </Link>
                  <ConfirmDeleteButton
                    action={deleteClass.bind(null, c.id)}
                    message="Bu sınıfı ve tüm öğrencilerini, ödevlerini silmek istediğine emin misin?"
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
