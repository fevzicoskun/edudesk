'use server'

import { revalidatePath } from 'next/cache'
import { UUID } from '@/src/shared/validation'
import { NoteService } from '@/src/domains/notes/services/NoteService'

export async function createNote(): Promise<string> {
  const id = await NoteService.createNote()
  revalidatePath('/notlar')
  return id
}

export async function updateNote(id: string, title: string, content: string): Promise<void> {
  UUID.parse(id)
  await NoteService.updateNote(id, title, content)
  revalidatePath('/notlar')
}

export async function deleteNote(id: string): Promise<void> {
  UUID.parse(id)
  await NoteService.deleteNote(id)
  revalidatePath('/notlar')
}
