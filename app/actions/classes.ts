'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { UUID, veliContactSchema } from '@/src/shared/validation'
import { createClassSchema, addStudentSchema, studentNoteSchema } from '@/src/domains/classes/validators'
import { ClassService } from '@/src/domains/classes/services/ClassService'
import { parseStudentRows, excelCellToString } from '@/src/domains/classes/services/studentImportParser'
import { getAbility } from '@/src/shared/authorization/server'
import { createClient } from '@/src/infrastructure/supabase/server'
import { logger } from '@/src/infrastructure/observability/logger'
import type { ActionResult } from '@/src/shared/types'

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

const MAX_IMPORT_FILE_BYTES = 2 * 1024 * 1024 // 2 MB

const excelImportFileSchema = z
  .instanceof(File, { message: 'Lütfen bir Excel dosyası seç.' })
  .refine((f) => f.size > 0, 'Dosya boş görünüyor.')
  .refine((f) => f.size <= MAX_IMPORT_FILE_BYTES, "Dosya boyutu 2 MB sınırını aşıyor.")
  .refine((f) => f.name.toLowerCase().endsWith('.xlsx'), 'Sadece .xlsx dosyaları destekleniyor.')

const parentContactSchema = z.object({
  note:           z.string().min(1, 'Not boş olamaz').max(500),
  contact_method: z.enum(['email', 'telefon', 'whatsapp', 'yuz_yuze', 'diger']),
  contacted_at:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Geçersiz tarih'),
})

export type ExcelImportResult = {
  added: number
  errors: { row: number; message: string }[]
  error?: string
}

export async function importStudentsFromExcel(
  classId: string,
  formData: FormData
): Promise<ExcelImportResult> {
  const idParsed = UUID.safeParse(classId)
  if (!idParsed.success) return { added: 0, errors: [], error: 'Geçersiz ID' }

  const fileParsed = excelImportFileSchema.safeParse(formData.get('file'))
  if (!fileParsed.success) {
    return { added: 0, errors: [], error: fileParsed.error.issues[0]?.message ?? 'Geçersiz dosya' }
  }

  // exceljs lazy-load — bundle'a girmesin (XlsxBuilder ile aynı kalıp)
  const { default: ExcelJS } = await import('exceljs')
  const workbook = new ExcelJS.Workbook()
  try {
    await workbook.xlsx.load(await fileParsed.data.arrayBuffer())
  } catch {
    return { added: 0, errors: [], error: 'Excel dosyası okunamadı. Dosyanın bozuk olmadığından emin ol.' }
  }

  const sheet = workbook.worksheets[0]
  if (!sheet) return { added: 0, errors: [], error: 'Excel dosyasında sayfa bulunamadı.' }

  const rows: string[][] = []
  sheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    const values = row.values as unknown[] // exceljs: 1 tabanlı sparse dizi
    const cells: string[] = []
    for (let c = 1; c < values.length; c++) cells.push(excelCellToString(values[c]))
    rows[rowNumber - 1] = cells
  })

  const { students, errors } = parseStudentRows(rows)
  if (students.length === 0) {
    return { added: 0, errors, error: errors.length === 0 ? 'Dosyada eklenecek öğrenci bulunamadı.' : undefined }
  }

  try {
    await ClassService.addStudentsBulk(classId, students)
  } catch (e) {
    logger.error({ classId, err: e instanceof Error ? e.message : String(e) }, 'importStudentsFromExcel: toplu ekleme başarısız')
    return {
      added: 0,
      errors,
      error: e instanceof Error ? e.message : 'Öğrenciler eklenirken hata oluştu. Lütfen tekrar dene.',
    }
  }

  revalidatePath(`/siniflar/${classId}`)
  return { added: students.length, errors }
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

export async function updateVeliContact(studentId: string, classId: string, formData: FormData): Promise<ActionResult> {
  try { UUID.parse(studentId); UUID.parse(classId) }
  catch { return { error: 'Geçersiz ID' } }

  const parsed = veliContactSchema.safeParse(Object.fromEntries(formData.entries()))
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Geçersiz veri' }

  const email   = parsed.data.veli_email   || null
  const telefon = parsed.data.veli_telefon || null
  const ad      = parsed.data.veli_ad      || null

  const result = await ClassService.updateVeliContact(studentId, { email, telefon, ad })
  if (result?.error) return { error: result.error }

  revalidatePath(`/siniflar/${classId}/ogrenciler/${studentId}`)
  return {}
}

export async function getMyClasses(): Promise<{ id: string; name: string; grade: number | null }[]> {
  const ability = await getAbility()
  if (!ability) return []
  const supabase = await createClient()
  const { data } = await supabase
    .from('classes')
    .select('id, name, grade')
    .eq('school_id', ability.schoolId)
    .is('deleted_at', null)
    .order('grade')
    .order('name')
  return data ?? []
}

export async function addParentContactLog(
  studentId: string,
  classId: string,
  formData: FormData,
): Promise<ActionResult> {
  try { UUID.parse(studentId); UUID.parse(classId) }
  catch { return { error: 'Geçersiz ID' } }

  const parsed = parentContactSchema.safeParse(Object.fromEntries(formData.entries()))
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Geçersiz veri' }

  try {
    await ClassService.addParentContactLog(studentId, {
      note:           parsed.data.note,
      contact_method: parsed.data.contact_method,
      contacted_at:   new Date(parsed.data.contacted_at + 'T00:00:00').toISOString(),
    })
  } catch (e) {
    logger.error({ studentId, err: e instanceof Error ? e.message : String(e) }, 'addParentContactLog: kayıt eklenemedi')
    return { error: e instanceof Error ? e.message : 'Kayıt eklenemedi.' }
  }

  revalidatePath(`/siniflar/${classId}/ogrenciler/${studentId}`)
  return {}
}

export async function deleteParentContactLog(
  logId: string,
  studentId: string,
  classId: string,
): Promise<ActionResult> {
  try { UUID.parse(logId); UUID.parse(studentId); UUID.parse(classId) }
  catch { return { error: 'Geçersiz ID' } }

  try {
    await ClassService.deleteParentContactLog(logId)
  } catch (e) {
    logger.error({ logId, err: e instanceof Error ? e.message : String(e) }, 'deleteParentContactLog: kayıt silinemedi')
    return { error: e instanceof Error ? e.message : 'Kayıt silinemedi.' }
  }

  revalidatePath(`/siniflar/${classId}/ogrenciler/${studentId}`)
  return {}
}

