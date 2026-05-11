import { createClient } from '@/lib/supabase/server'
import NotesEditor from './NotesEditor'

export default async function NotlarPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data } = await supabase
    .from('user_notes')
    .select('content')
    .eq('user_id', user!.id)
    .single()

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Notlarım</h1>
        <p className="text-sm text-gray-500 mt-0.5">Kişisel not alanınız — yalnızca siz görürsünüz</p>
      </div>
      <NotesEditor initialContent={data?.content ?? ''} />
    </div>
  )
}
