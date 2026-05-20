import { insertNote, updateNote, deleteNote } from '@/src/queries/notes'
import { createClient } from '@/src/infrastructure/supabase/server'

export const NoteService = {
  async createNote(): Promise<string> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { data, error } = await insertNote(user.id)
    if (error) throw new Error(error.message)
    return data.id
  },

  async updateNote(id: string, title: string, content: string): Promise<void> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { error } = await updateNote(id, user.id, {
      title:   String(title).slice(0, 200),
      content: String(content).slice(0, 50000),
    })
    if (error) throw new Error(error.message)
  },

  async deleteNote(id: string): Promise<void> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { error } = await deleteNote(id, user.id)
    if (error) throw new Error(error.message)
  },
}
