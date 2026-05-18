'use server'

import { revalidatePath } from 'next/cache'
import { UUID } from '@/src/shared/validation'
import { createClassSchema, addStudentSchema, studentNoteSchema } from '@/src/domains/classes/validators'
import { ClassService } from '@/src/domains/classes/services/ClassService'
import { getCurrentProfile, getCurrentUser } from '@/src/shared/auth'
import { createClient } from '@/lib/supabase/server'

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

export async function restoreClass(classId: string) {
  UUID.parse(classId)
  await ClassService.restoreClass(classId)
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
    full_name:      parsed.data.full_name,
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
  await ClassService.deleteStudent(studentId)
  revalidatePath(`/siniflar/${classId}`)
}

export async function restoreStudent(studentId: string, classId: string) {
  UUID.parse(studentId)
  UUID.parse(classId)
  await ClassService.restoreStudent(studentId)
  revalidatePath(`/siniflar/${classId}`)
}

export async function deleteStudentNote(noteId: string, studentId: string, classId: string) {
  UUID.parse(noteId)
  UUID.parse(studentId)
  UUID.parse(classId)
  await ClassService.deleteStudentNote(noteId)
  revalidatePath(`/siniflar/${classId}/ogrenciler/${studentId}`)
}

export async function addStudentNote(studentId: string, classId: string, formData: FormData) {
  UUID.parse(studentId)
  UUID.parse(classId)
  const parsed = studentNoteSchema.safeParse({ body: formData.get('body') })
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message)

  await ClassService.addStudentNote(studentId, { body: parsed.data.body })
  revalidatePath(`/siniflar/${classId}/ogrenciler/${studentId}`)
}

export async function assignMentor(classId: string, teacherId: string | null) {
  UUID.parse(classId)
  if (teacherId !== null) UUID.parse(teacherId)

  const profile = await getCurrentProfile()
  if (profile?.role !== 'mudur_yardimcisi') {
    throw new Error('Bu işlem için Müdür Yardımcısı yetkisi gereklidir.')
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('classes')
    .update({ mentor_teacher_id: teacherId })
    .eq('id', classId)
    .eq('school_id', profile.school_id)

  if (error) throw new Error(`Mentor atanamadı: ${error.message}`)
  revalidatePath('/siniflar/' + classId)
}

export async function addMentorReport(
  studentId: string,
  classId: string,
  formData: FormData
) {
  UUID.parse(studentId)
  UUID.parse(classId)

  const content     = String(formData.get('content') ?? '').trim()
  const report_date = String(formData.get('report_date') ?? '').trim()

  if (content.length < 5) throw new Error('Rapor içeriği en az 5 karakter olmalı.')
  if (!report_date) throw new Error('Rapor tarihi zorunludur.')

  const user = await getCurrentUser()
  if (!user) throw new Error('Oturum gerekli.')
  const profile = await getCurrentProfile()
  if (!profile) throw new Error('Profil bulunamadı.')

  const supabase = await createClient()

  // Sadece sınıfın mentörü ekleyebilir
  const { data: cls } = await supabase
    .from('classes')
    .select('mentor_teacher_id')
    .eq('id', classId)
    .eq('school_id', profile.school_id)
    .single()

  if (!cls || cls.mentor_teacher_id !== user.id) {
    throw new Error('Bu sınıfın mentörü değilsiniz.')
  }

  const { error } = await supabase.from('mentor_reports').insert({
    mentor_id:   user.id,
    student_id:  studentId,
    class_id:    classId,
    school_id:   profile.school_id!,
    content,
    report_date,
  })

  if (error) throw new Error(`Rapor kaydedilemedi: ${error.message}`)
  revalidatePath(`/siniflar/${classId}/ogrenciler/${studentId}`)
}

export async function deleteMentorReport(
  reportId: string,
  studentId: string,
  classId: string
) {
  UUID.parse(reportId)
  const supabase = await createClient()
  const { error } = await supabase
    .from('mentor_reports')
    .delete()
    .eq('id', reportId)

  if (error) throw new Error(`Rapor silinemedi: ${error.message}`)
  revalidatePath(`/siniflar/${classId}/ogrenciler/${studentId}`)
}
