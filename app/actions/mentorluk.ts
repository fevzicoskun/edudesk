'use server'

import { revalidatePath } from 'next/cache'
import { MentorService } from '@/src/domains/mentor/services/MentorService'

export async function addMentorStudent(formData: FormData) {
  const full_name = (formData.get('full_name') as string)?.trim()
  if (!full_name || full_name.length < 2) throw new Error('İsim en az 2 karakter olmalı.')

  await MentorService.addMentorStudent({
    full_name,
    parent_name: (formData.get('parent_name') as string)?.trim() || null,
    phone:       (formData.get('phone') as string)?.trim() || null,
  })
  revalidatePath('/mentorluk')
}

export async function deleteMentorStudent(id: string) {
  await MentorService.deleteMentorStudent(id)
  revalidatePath('/mentorluk')
}

export async function addMentorStudentNote(formData: FormData) {
  const mentor_student_id = (formData.get('mentor_student_id') as string)?.trim()
  const content           = (formData.get('content') as string)?.trim()

  if (!mentor_student_id) throw new Error('Öğrenci ID gerekli.')
  if (!content || content.length < 2)    throw new Error('Not en az 2 karakter olmalı.')
  if (content.length > 2000) throw new Error('Not en fazla 2000 karakter olabilir.')

  await MentorService.addMentorStudentNote({ mentor_student_id, content })
  revalidatePath('/mentorluk')
}

export async function deleteMentorStudentNote(id: string) {
  await MentorService.deleteMentorStudentNote(id)
  revalidatePath('/mentorluk')
}
