'use server'

import { createClient } from '@/lib/supabase/server'

export async function saveNote(content: string): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const { error } = await supabase
    .from('user_notes')
    .upsert(
      { user_id: user.id, content, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    )

  if (error) throw new Error(error.message)
}
