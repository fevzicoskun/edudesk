'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile, getCurrentUser } from '@/src/shared/auth'

export async function addMentorStudent(formData: FormData) {
  const [user, profile] = await Promise.all([getCurrentUser(), getCurrentProfile()])
  if (!user || !profile) throw new Error('Oturum gerekli.')

  const full_name = (formData.get('full_name') as string)?.trim()
  if (!full_name || full_name.length < 2) throw new Error('İsim en az 2 karakter olmalı.')

  const parent_name = (formData.get('parent_name') as string)?.trim() || null
  const phone = (formData.get('phone') as string)?.trim() || null

  const supabase = await createClient()
  const { error } = await supabase.from('mentor_students').insert({
    teacher_id: user.id,
    school_id: profile.school_id,
    full_name,
    parent_name,
    phone,
  })
  if (error) throw new Error(error.message)
  revalidatePath('/mentorluk')
}

export async function deleteMentorStudent(id: string) {
  const [user, profile] = await Promise.all([getCurrentUser(), getCurrentProfile()])
  if (!user || !profile) throw new Error('Oturum gerekli.')

  const supabase = await createClient()
  await supabase.from('mentor_students').delete()
    .eq('id', id).eq('teacher_id', user.id).eq('school_id', profile.school_id)
  revalidatePath('/mentorluk')
}

export async function addMentorStudentNote(formData: FormData) {
  const [user, profile] = await Promise.all([getCurrentUser(), getCurrentProfile()])
  if (!user || !profile) throw new Error('Oturum gerekli.')

  const mentor_student_id = (formData.get('mentor_student_id') as string)?.trim()
  const content = (formData.get('content') as string)?.trim()

  if (!mentor_student_id) throw new Error('Öğrenci ID gerekli.')
  if (!content || content.length < 2) throw new Error('Not en az 2 karakter olmalı.')
  if (content.length > 2000) throw new Error('Not en fazla 2000 karakter olabilir.')

  const supabase = await createClient()

  const { data: student } = await supabase
    .from('mentor_students')
    .select('id')
    .eq('id', mentor_student_id)
    .eq('teacher_id', user.id)
    .eq('school_id', profile.school_id)
    .single()
  if (!student) throw new Error('Öğrenci bulunamadı.')

  const { error } = await supabase.from('mentor_student_notes').insert({
    mentor_student_id,
    teacher_id: user.id,
    school_id: profile.school_id,
    content,
  })
  if (error) throw new Error(error.message)
  revalidatePath('/mentorluk')
}

export async function deleteMentorStudentNote(id: string) {
  const [user, profile] = await Promise.all([getCurrentUser(), getCurrentProfile()])
  if (!user || !profile) throw new Error('Oturum gerekli.')

  const supabase = await createClient()
  await supabase.from('mentor_student_notes').delete()
    .eq('id', id).eq('teacher_id', user.id).eq('school_id', profile.school_id)
  revalidatePath('/mentorluk')
}
