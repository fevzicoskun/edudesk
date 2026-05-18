'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireSchoolId } from '@/lib/auth'
import { UUID, createClassSchema, addStudentSchema, studentNoteSchema } from '@/lib/validation'
import { ClassService } from '../services/ClassService'

export async function createClass(formData: FormData) {
  const parsed = createClassSchema.safeParse({
    name:  formData.get('name'),
    grade: formData.get('grade'),
  })
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message)

  await ClassService.createClass(parsed.data)
  revalidatePath('/siniflar')
}

export async function deleteClass(classId: string) {
  UUID.parse(classId)
  await ClassService.deleteClass(classId)
  revalidatePath('/siniflar')
}

export async function addStudent(classId: string, formData: FormData) {
  UUID.parse(classId)
  const parsed = addStudentSchema.safeParse({
    full_name:      formData.get('full_name'),
    student_number: formData.get('student_number') || null,
  })
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message)

  await ClassService.addStudent(classId, {
    full_name: parsed.data.full_name,
    student_number: parsed.data.student_number ?? null,
  })
  revalidatePath(`/siniflar/${classId}`)
}

export async function addStudentsBulk(
  classId: string,
  students: { full_name: string; student_number: string | null }[]
) {
  UUID.parse(classId)
  await ClassService.addStudentsBulk(classId, students)
  revalidatePath(`/siniflar/${classId}`)
}

export async function deleteStudent(studentId: string, classId: string) {
  UUID.parse(studentId)
  UUID.parse(classId)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await ClassService.deleteStudent(studentId)
  revalidatePath(`/siniflar/${classId}`)
}

export async function deleteStudentNote(noteId: string, studentId: string, classId: string) {
  UUID.parse(noteId)
  UUID.parse(studentId)
  UUID.parse(classId)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await ClassService.deleteStudentNote(noteId)
  revalidatePath(`/siniflar/${classId}/ogrenciler/${studentId}`)
}

export async function addStudentNote(studentId: string, classId: string, formData: FormData) {
  UUID.parse(studentId)
  UUID.parse(classId)
  const parsed = studentNoteSchema.safeParse({ body: formData.get('body') })
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message)

  const [supabase, school_id] = await Promise.all([createClient(), requireSchoolId()])
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await ClassService.addStudentNote(studentId, { body: parsed.data.body }, user.id, school_id)
  revalidatePath(`/siniflar/${classId}/ogrenciler/${studentId}`)
}
