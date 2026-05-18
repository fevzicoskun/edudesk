import { createClient } from '@/lib/supabase/server'
import NotesLayout from './NotesLayout'
import NotlarExportButton from './NotlarExportButton'
import type { Note } from './NotesLayout'

export default async function NotlarPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: notes } = await supabase
    .from('user_notes')
    .select('id, title, content, created_at, updated_at')
    .eq('user_id', user!.id)
    .order('updated_at', { ascending: false })

  const notesList = (notes ?? []) as Note[]

  return (
    <div className="h-full flex flex-col p-4 md:p-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">Notlarım</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">Kişisel notlarınız — yalnızca siz görürsünüz</p>
        </div>
        <NotlarExportButton notes={notesList} />
      </div>
      <NotesLayout notes={notesList} />
    </div>
  )
}
