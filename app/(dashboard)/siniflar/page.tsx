import { createClient } from '@/lib/supabase/server'
import { createClass } from '@/app/actions/class'
import { getEgitimYili } from '@/lib/utils'
import SinifArama from './SinifArama'

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
        <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">Sınıflar</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">{egitimYili} Eğitim Yılı</p>
      </div>

      <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-5 mb-5">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3">Yeni Sınıf Ekle</h2>
        <form action={createClass} className="flex gap-2 flex-wrap">
          <input
            name="name"
            type="text"
            required
            placeholder="9-A"
            className="px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            name="grade"
            type="number"
            required
            placeholder="Sınıf (9)"
            min="1"
            max="12"
            className="px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm w-28 bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
        <SinifArama classes={classes as { id: string; name: string; grade: number; students: { id: string }[] }[]} />
      )}
    </div>
  )
}
