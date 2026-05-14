'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { UUID } from '@/lib/validation'

export async function createNote(): Promise<string> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data, error } = await supabase
    .from('user_notes')
    .insert({ user_id: user.id, title: 'Yeni Not', content: '' })
    .select('id')
    .single()

  if (error) throw new Error(error.message)
  revalidatePath('/notlar')
  return data.id
}

export async function updateNote(id: string, title: string, content: string): Promise<void> {
  UUID.parse(id)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { error } = await supabase
    .from('user_notes')
    .update({
      title: String(title).slice(0, 200),
      content: String(content).slice(0, 50000),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) throw new Error(error.message)
}

export async function deleteNote(id: string): Promise<void> {
  UUID.parse(id)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { error } = await supabase
    .from('user_notes')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) throw new Error(error.message)
  revalidatePath('/notlar')
}
