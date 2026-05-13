'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEgitimYili } from '@/lib/utils'

export async function createClass(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await supabase.from('classes').insert({
    name: formData.get('name') as string,
    grade: Number(formData.get('grade')),
    academic_year: getEgitimYili(),
  })

  revalidatePath('/siniflar')
}

export async function deleteClass(classId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: homeworks } = await supabase
    .from('homeworks')
    .select('id')
    .eq('class_id', classId)
    
  if (homeworks?.length) {
    const homeworkIds = homeworks.map((h) => h.id)
    await supabase.from('homework_submissions').delete().in('homework_id', homeworkIds)
    await supabase.from('homeworks').delete().in('id', homeworkIds)
  }

  await supabase.from('students').delete().eq('class_id', classId)
  await supabase.from('classes').delete().eq('id', classId)

  revalidatePath('/siniflar')
}

export async function addStudent(classId: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await supabase.from('students').insert({
    class_id: classId,
    full_name: formData.get('full_name') as string,
    student_number: (formData.get('student_number') as string) || null,
  })

  revalidatePath(`/siniflar/${classId}`)
}

export async function addStudentsBulk(
  classId: string,
  students: { full_name: string; student_number: string | null }[]
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await supabase.from('students').insert(
    students.map((s) => ({ class_id: classId, ...s }))
  )

  revalidatePath(`/siniflar/${classId}`)
}

export async function deleteStudent(studentId: string, classId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await supabase.from('homework_submissions').delete().eq('student_id', studentId)
  await supabase.from('student_notes').delete().eq('student_id', studentId)
  await supabase.from('students').delete().eq('id', studentId)

  revalidatePath(`/siniflar/${classId}`)
}

export async function deleteStudentNote(noteId: string, studentId: string, classId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  await supabase.from('student_notes').delete().eq('id', noteId)
  revalidatePath(`/siniflar/${classId}/ogrenciler/${studentId}`)
}

export async function addStudentNote(studentId: string, classId: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const body = String(formData.get('body') ?? '').trim()
  if (!body) return

  await supabase.from('student_notes').insert({
    teacher_id: user.id,
    student_id: studentId,
    body,
  })

  revalidatePath(`/siniflar/${classId}/ogrenciler/${studentId}`)
}
