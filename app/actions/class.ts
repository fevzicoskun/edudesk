'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile, requireSchoolId } from '@/lib/auth'
import { getEgitimYili } from '@/lib/utils'
import { UUID, createClassSchema, addStudentSchema, studentNoteSchema } from '@/lib/validation'
import { logAudit } from '@/lib/audit'

async function requireBaskan() {
  const profile = await getCurrentProfile()
  if (profile?.role !== 'zumre_baskani' && profile?.role !== 'mudur_yardimcisi') {
    throw new Error('Bu işlem için Zümre Başkanı veya Müdür Yardımcısı yetkisi gereklidir.')
  }
}

export async function createClass(formData: FormData) {
  await requireBaskan()
  const parsed = createClassSchema.safeParse({
    name: formData.get('name'),
    grade: formData.get('grade'),
  })
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message)

  const [supabase, school_id] = await Promise.all([createClient(), requireSchoolId()])
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { error: insertError } = await supabase.from('classes').insert({
    name: parsed.data.name,
    grade: parsed.data.grade,
    academic_year: getEgitimYili(),
    school_id,
  })
  if (insertError) throw new Error(insertError.message)

  await logAudit({ user_id: user.id, action: 'class.create', table_name: 'classes', new_data: { name: parsed.data.name, grade: parsed.data.grade }, school_id })
  revalidatePath('/siniflar')
}

export async function deleteClass(classId: string) {
  await requireBaskan()
  UUID.parse(classId)

  const [supabase, school_id] = await Promise.all([createClient(), requireSchoolId()])
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: homeworks } = await supabase
    .from('homeworks')
    .select('id')
    .eq('class_id', classId)
    .eq('school_id', school_id)

  if (homeworks?.length) {
    const homeworkIds = homeworks.map((h) => h.id)
    await supabase.from('homework_submissions').delete().in('homework_id', homeworkIds)
    await supabase.from('homeworks').delete().in('id', homeworkIds).eq('school_id', school_id)
  }

  await supabase.from('attendance').delete().eq('class_id', classId).eq('school_id', school_id)
  await supabase.from('teacher_classes').delete().eq('class_id', classId)
  await supabase.from('curriculum_progress').delete().eq('class_id', classId).eq('school_id', school_id)
  await supabase.from('students').delete().eq('class_id', classId).eq('school_id', school_id)
  await supabase.from('classes').delete().eq('id', classId).eq('school_id', school_id)

  await logAudit({ user_id: user.id, action: 'class.delete', table_name: 'classes', record_id: classId })
  revalidatePath('/siniflar')
}

export async function addStudent(classId: string, formData: FormData) {
  UUID.parse(classId)
  const parsed = addStudentSchema.safeParse({
    full_name: formData.get('full_name'),
    student_number: formData.get('student_number') || null,
  })
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message)

  const [supabase, school_id] = await Promise.all([createClient(), requireSchoolId()])
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await supabase.from('students').insert({
    class_id: classId,
    full_name: parsed.data.full_name,
    student_number: parsed.data.student_number ?? null,
    school_id,
  })

  revalidatePath(`/siniflar/${classId}`)
}

export async function addStudentsBulk(
  classId: string,
  students: { full_name: string; student_number: string | null }[]
) {
  UUID.parse(classId)
  if (students.length > 100) throw new Error('En fazla 100 öğrenci eklenebilir')

  const [supabase, school_id] = await Promise.all([createClient(), requireSchoolId()])
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const valid = students
    .map(s => ({ full_name: s.full_name.trim().slice(0, 120), student_number: s.student_number?.slice(0, 20) ?? null }))
    .filter(s => s.full_name.length >= 2)

  await supabase.from('students').insert(
    valid.map((s) => ({ class_id: classId, school_id, ...s }))
  )

  revalidatePath(`/siniflar/${classId}`)
}

export async function deleteStudent(studentId: string, classId: string) {
  UUID.parse(studentId)
  UUID.parse(classId)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await supabase.from('homework_submissions').delete().eq('student_id', studentId)
  await supabase.from('student_notes').delete().eq('student_id', studentId)
  await supabase.from('students').delete().eq('id', studentId)

  revalidatePath(`/siniflar/${classId}`)
}

export async function deleteStudentNote(noteId: string, studentId: string, classId: string) {
  UUID.parse(noteId)
  UUID.parse(studentId)
  UUID.parse(classId)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  await supabase.from('student_notes').delete().eq('id', noteId)
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

  await supabase.from('student_notes').insert({
    teacher_id: user.id,
    student_id: studentId,
    body: parsed.data.body,
    school_id,
  })

  revalidatePath(`/siniflar/${classId}/ogrenciler/${studentId}`)
}
