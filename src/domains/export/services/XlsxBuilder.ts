import { createServiceClient } from '@/src/infrastructure/supabase/service'
import { UUID } from '@/src/shared/validation'
import * as XLSX from 'xlsx'
import type { JobType } from '../types'

const JOB_LABELS: Record<JobType, string> = {
  excel_odevler:           'Ödevler',
  excel_notlar:            'Öğrenci Notları',
  excel_sinif_ogrencileri: 'Sınıf Öğrencileri',
}

export async function fetchRows(
  jobType: JobType,
  params: Record<string, string>,
  schoolId: string
): Promise<Record<string, unknown>[]> {
  switch (jobType) {
    case 'excel_odevler':           return fetchOdevler(params, schoolId)
    case 'excel_notlar':            return fetchNotlar(schoolId)
    case 'excel_sinif_ogrencileri': return fetchSinifOgrencileri(params, schoolId)
    default: throw new Error(`Bilinmeyen iş türü: ${jobType}`)
  }
}

export function buildXlsx(rows: Record<string, unknown>[], jobType: JobType): Buffer {
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(
    rows.length ? rows : [{ 'Bilgi': 'Veri bulunamadı' }]
  )

  if (rows.length) {
    ws['!cols'] = Object.keys(rows[0]).map(k =>
      ({
        wch: Math.min(50, Math.max(k.length, ...rows.slice(0, 50).map(r => String(r[k] ?? '').length))),
      })
    )
  }

  XLSX.utils.book_append_sheet(wb, ws, JOB_LABELS[jobType])
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
}

export async function uploadToStorage(
  buffer: Buffer,
  userId: string,
  jobType: JobType
): Promise<{ url: string; filename: string }> {
  const db = createServiceClient()
  const date = new Date().toISOString().split('T')[0]
  const filename = `${jobType}-${date}.xlsx`
  const path = `${userId}/${filename}`

  const { error: uploadErr } = await db.storage
    .from('exports')
    .upload(path, buffer, {
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      upsert: true,
    })
  if (uploadErr) throw new Error(`Storage upload hatası: ${uploadErr.message}`)

  const { data: signed } = await db.storage
    .from('exports')
    .createSignedUrl(path, 3600)
  if (!signed?.signedUrl) throw new Error('Signed URL oluşturulamadı')

  return { url: signed.signedUrl, filename }
}

// ─── Data fetchers ────────────────────────────────────────────

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

async function fetchOdevler(params: Record<string, string>, schoolId: string) {
  const db = createServiceClient()
  let q = db
    .from('homeworks')
    .select('title, subject, due_date, classes(name)')
    .eq('school_id', schoolId)
    .order('due_date', { ascending: false })
    .limit(2000)

  if (params.classId) { UUID.parse(params.classId); q = q.eq('class_id', params.classId) }
  if (params.since) {
    if (!DATE_RE.test(params.since)) throw new Error('Geçersiz tarih formatı: since')
    q = q.gte('due_date', params.since)
  }
  if (params.until) {
    if (!DATE_RE.test(params.until)) throw new Error('Geçersiz tarih formatı: until')
    q = q.lte('due_date', params.until)
  }

  const { data, error } = await q
  if (error) throw new Error(`Ödevler sorgu hatası: ${error.message}`)

  return (data ?? []).map(h => ({
    'Ödev Başlığı': h.title,
    'Ders':         h.subject,
    'Son Tarih':    h.due_date,
    'Sınıf':        (h.classes as unknown as { name: string } | null)?.name ?? '—',
  }))
}

async function fetchNotlar(schoolId: string) {
  const db = createServiceClient()
  const { data, error } = await db
    .from('student_notes')
    .select('body, created_at, students(full_name)')
    .eq('school_id', schoolId)
    .order('created_at', { ascending: false })
    .limit(2000)
  if (error) throw new Error(`Notlar sorgu hatası: ${error.message}`)

  return (data ?? []).map(n => ({
    'Öğrenci': (n.students as unknown as { full_name: string } | null)?.full_name ?? '—',
    'Not':     n.body,
    'Tarih':   n.created_at?.split('T')[0] ?? '—',
  }))
}

async function fetchSinifOgrencileri(params: Record<string, string>, schoolId: string) {
  const db = createServiceClient()
  let q = db
    .from('students')
    .select('full_name, student_number, classes(name)')
    .eq('school_id', schoolId)
    .order('student_number', { nullsFirst: false })
    .order('full_name')
    .limit(2000)

  if (params.classId) { UUID.parse(params.classId); q = q.eq('class_id', params.classId) }

  q = q.is('deleted_at', null)

  const { data, error } = await q
  if (error) throw new Error(`Öğrenciler sorgu hatası: ${error.message}`)

  return (data ?? []).map((s, i) => ({
    'No':      s.student_number ?? String(i + 1),
    'Ad Soyad': s.full_name,
    'Sınıf':   (s.classes as unknown as { name: string } | null)?.name ?? '—',
  }))
}
