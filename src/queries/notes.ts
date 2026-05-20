import { createClient } from '@/src/infrastructure/supabase/server'

export async function insertNote(userId: string) {
  const supabase = await createClient()
  return supabase
    .from('user_notes')
    .insert({ user_id: userId, title: 'Yeni Not', content: '' })
    .select('id')
    .single()
}

export async function updateNote(id: string, userId: string, data: { title: string; content: string }) {
  const supabase = await createClient()
  return supabase
    .from('user_notes')
    .update({
      title:      data.title,
      content:    data.content,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', userId)
}

export async function deleteNote(id: string, userId: string) {
  const supabase = await createClient()
  return supabase
    .from('user_notes')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)
}
