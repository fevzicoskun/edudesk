'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import * as XLSX from 'xlsx'

type CurriculumStatus = 'tamamlandi' | 'tekrar_gerekli' | 'eksik_kaldi'

export async function createMeeting(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await supabase.from('zumre_meetings').insert({
    title: formData.get('title') as string,
    meeting_date: formData.get('meeting_date') as string,
    notes: (formData.get('notes') as string) || null,
    created_by: user.id,
  })

  revalidatePath('/zumre')
}

export async function createExam(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await supabase.from('common_exams').insert({
    title: formData.get('title') as string,
    subject: formData.get('subject') as string,
    exam_date: formData.get('exam_date') as string,
    created_by: user.id,
  })

  revalidatePath('/zumre')
}

export async function createCurriculumProgress(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const grade = Number(formData.get('grade'))
  const { data: cls } = await supabase
    .from('classes')
    .select('id')
    .eq('grade', grade)
    .order('name')
    .limit(1)
    .single()
  if (!cls) redirect('/zumre?tab=mufredat')

  await supabase.from('curriculum_progress').insert({
    teacher_id: user.id,
    class_id: cls.id,
    topic: formData.get('topic') as string,
    week_number: formData.get('week_number') ? Number(formData.get('week_number')) : null,
    status: (formData.get('status') as CurriculumStatus) || 'tamamlandi',
    completed: formData.get('status') !== 'eksik_kaldi',
    completion_date:
      formData.get('status') === 'tamamlandi' ? new Date().toISOString().split('T')[0] : null,
  })

  revalidatePath('/zumre')
}

export async function updateCurriculumStatus(id: string, status: CurriculumStatus, _: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await supabase
    .from('curriculum_progress')
    .update({
      status,
      completed: status !== 'eksik_kaldi',
      completion_date: status === 'tamamlandi' ? new Date().toISOString().split('T')[0] : null,
    })
    .eq('id', id)
    .eq('teacher_id', user.id)

  revalidatePath('/zumre')
}

export async function toggleCurriculumDone(id: string, completed: boolean, _: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await supabase
    .from('curriculum_progress')
    .update({ completed, completion_date: completed ? new Date().toISOString().split('T')[0] : null })
    .eq('id', id)
    .eq('teacher_id', user.id)

  revalidatePath('/zumre')
}

export async function deleteMeeting(id: string, _: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await supabase.from('zumre_meetings').delete().eq('id', id)

  revalidatePath('/zumre')
}

export async function deleteExam(id: string, _: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await supabase.from('common_exams').delete().eq('id', id)

  revalidatePath('/zumre')
}

export async function deleteCurriculumProgress(id: string, _: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await supabase.from('curriculum_progress').delete().eq('id', id).eq('teacher_id', user.id)

  revalidatePath('/zumre')
}

type ImportState = { imported?: number; error?: string } | null

function parseExcel(buffer: Buffer): { topic: string; week_number: number | null }[] {
  const wb = XLSX.read(buffer, { type: 'buffer' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })
  if (rows.length === 0) return []

  const headers = Object.keys(rows[0])
  const topicCol =
    headers.find(h => /kazanım ifadesi|kazanim ifadesi/i.test(h)) ??
    headers.find(h => /kazanım|kazanim|konu|öğrenme çıktısı|hedef|içerik/i.test(h)) ??
    headers[0]
  const weekCol = headers.find(h => /hafta|süre|sure|ders saati|saat/i.test(h))

  return rows
    .map(row => ({
      topic: String(row[topicCol] ?? '').trim(),
      week_number: weekCol ? (Number(row[weekCol]) || null) : null,
    }))
    .filter(r => r.topic.length > 3)
}

export async function importCurriculumFromFile(
  _prev: ImportState,
  formData: FormData
): Promise<ImportState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Giriş gerekli' }

  const file = formData.get('file') as File | null
  const grade = Number(formData.get('grade'))

  if (!file || file.size === 0) return { error: 'Dosya seçilmedi' }
  if (!grade) return { error: 'Sınıf seviyesi seçilmedi' }

  const { data: cls } = await supabase
    .from('classes')
    .select('id')
    .eq('grade', grade)
    .order('name')
    .limit(1)
    .single()
  if (!cls) return { error: `${grade}. sınıf için kayıt bulunamadı` }

  const classId = cls.id

  const name = file.name.toLowerCase()
  if (name.endsWith('.pdf')) return { error: 'PDF desteklenmiyor — Excel (.xlsx) kullanın' }

  const buffer = Buffer.from(await file.arrayBuffer())

  let topics: { topic: string; week_number: number | null }[] = []

  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    topics = parseExcel(buffer)
  } else {
    return { error: 'Sadece .xlsx veya .xls desteklenir' }
  }

  if (topics.length === 0) return { error: 'Dosyadan konu çıkarılamadı' }

  const rows = topics.map(t => ({
    teacher_id: user.id,
    class_id: classId,
    topic: t.topic,
    week_number: t.week_number,
    status: 'tamamlandi' as const,
    completed: true,
    completion_date: null,
  }))

  const { error } = await supabase.from('curriculum_progress').insert(rows)
  if (error) return { error: error.message }

  revalidatePath('/zumre')
  return { imported: rows.length }
}
