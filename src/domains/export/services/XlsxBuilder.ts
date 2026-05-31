import { createServiceClient } from '@/src/infrastructure/supabase/service'
import { UUID } from '@/src/shared/validation'
import * as XLSX from 'xlsx'
import type { JobType } from '../types'

const JOB_LABELS: Record<JobType, string> = {
  excel_odevler:           'Ödevler',
  excel_notlar:            'Öğrenci Notları',
  excel_sinif_ogrencileri: 'Sınıf Öğrencileri',
  excel_not_defteri:       'Not Defteri',
  excel_yoklama:           'Yoklama',
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
    case 'excel_not_defteri':       throw new Error('Not Defteri export route handler üzerinden çağrılmalı')
    case 'excel_yoklama':           return fetchYoklama(params, schoolId)
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

function fmtDate(iso: string) {
  const [y, m, d] = iso.split('-')
  return `${d}.${m}.${y}`
}

async function fetchOdevler(params: Record<string, string>, schoolId: string) {
  const db = createServiceClient()
  let q = db
    .from('homeworks')
    .select('title, subject, due_date, classes(name), homework_submissions(status)')
    .eq('school_id', schoolId)
    .is('deleted_at', null)
    .order('due_date', { ascending: false })
    .limit(500)

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

  return (data ?? []).map(h => {
    const subs = (h.homework_submissions ?? []) as { status: string }[]
    const count = (s: string) => subs.filter(x => x.status === s).length
    return {
      'Sınıf':      (h.classes as unknown as { name: string } | null)?.name ?? '—',
      'Ders':       h.subject,
      'Ödev':       h.title,
      'Son Tarih':  fmtDate(h.due_date),
      'Yapıldı':    count('yapildi'),
      'Eksik':      count('eksik'),
      'Yapılmadı':  count('yapilmadi'),
      'Geç':        count('gec'),
      'Mazeretli':  count('mazeretli'),
      'Toplam':     subs.length,
    }
  })
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
    'Tarih':   n.created_at ? fmtDate(n.created_at.split('T')[0]) : '—',
  }))
}

async function fetchSinifOgrencileri(params: Record<string, string>, schoolId: string) {
  const db = createServiceClient()
  let q = db
    .from('students')
    .select('full_name, student_number, classes(name)')
    .eq('school_id', schoolId)
    .is('deleted_at', null)
    .order('full_name')
    .limit(2000)

  if (params.classId) { UUID.parse(params.classId); q = q.eq('class_id', params.classId) }

  const { data, error } = await q
  if (error) throw new Error(`Öğrenciler sorgu hatası: ${error.message}`)

  const rows = (data ?? []).map(s => ({
    className: (s.classes as unknown as { name: string } | null)?.name ?? '',
    full_name: s.full_name,
    student_number: s.student_number,
  }))

  // Sınıf adına göre grupla, grup içinde numara sırasına göre sırala
  rows.sort((a, b) => {
    const cls = a.className.localeCompare(b.className, 'tr')
    if (cls !== 0) return cls
    const na = parseInt(a.student_number ?? '', 10)
    const nb = parseInt(b.student_number ?? '', 10)
    if (!isNaN(na) && !isNaN(nb)) return na - nb
    return a.full_name.localeCompare(b.full_name, 'tr')
  })

  return rows.map(s => ({
    'Sınıf':    s.className || '—',
    'No':       s.student_number ?? '—',
    'Ad Soyad': s.full_name,
  }))
}

async function fetchYoklama(params: Record<string, string>, schoolId: string) {
  const db = createServiceClient()
  let q = db
    .from('attendance')
    .select('date, status, students(full_name, student_number), classes(name)')
    .eq('school_id', schoolId)
    .in('status', ['absent', 'late'])   // present kayıtları rapora dahil edilmez
    .order('full_name', { referencedTable: 'students' })
    .order('date', { ascending: true })
    .limit(10000)

  if (params.classId) { UUID.parse(params.classId); q = q.eq('class_id', params.classId) }
  if (params.since) {
    if (!DATE_RE.test(params.since)) throw new Error('Geçersiz tarih formatı: since')
    q = q.gte('date', params.since)
  }
  if (params.until) {
    if (!DATE_RE.test(params.until)) throw new Error('Geçersiz tarih formatı: until')
    q = q.lte('date', params.until)
  }

  const { data, error } = await q
  if (error) throw new Error(`Yoklama sorgu hatası: ${error.message}`)

  const STATUS_LABELS: Record<string, string> = { absent: 'Gelmedi', late: 'Geç Geldi' }

  return (data ?? []).map(r => {
    const student = r.students as unknown as { full_name: string; student_number: string | null } | null
    const cls     = r.classes  as unknown as { name: string } | null
    return {
      'Sınıf':    cls?.name ?? '—',
      'No':       student?.student_number ?? '—',
      'Ad Soyad': student?.full_name ?? '—',
      'Tarih':    fmtDate(r.date),
      'Durum':    STATUS_LABELS[r.status] ?? r.status,
    }
  })
}

