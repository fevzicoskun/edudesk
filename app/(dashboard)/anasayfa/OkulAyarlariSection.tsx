import { createClient } from '@/src/infrastructure/supabase/server'
import { requireSchoolId } from '@/src/shared/auth'
import OkulAyarlari from './OkulAyarlari'

export default async function OkulAyarlariSection() {
  const supabase  = await createClient()
  const school_id = await requireSchoolId()
  const { data: school } = await supabase.from('schools').select('name, slug').eq('id', school_id).single()
  return <OkulAyarlari initialName={school?.name ?? ''} initialCode={school?.slug ?? ''} />
}
