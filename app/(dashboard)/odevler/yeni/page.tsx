import { createClient } from '@/lib/supabase/server'
import HomeworkForm from './HomeworkForm'

export default async function YeniOdevPage() {
  const supabase = await createClient()
  const { data: classes } = await supabase
    .from('classes')
    .select('id, name, grade')
    .order('grade')
    .order('name')

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold text-gray-900 mb-6">Yeni Ödev</h1>
      <HomeworkForm classes={classes ?? []} />
    </div>
  )
}
