import ExcelJS from 'exceljs'
import { createServiceClient } from '@/src/infrastructure/supabase/service'
import { UUID } from '@/src/shared/validation'
import type { JobType } from '../types'
import { XLSX_EXPORT_LIMIT, XLSX_EXPORT_LIMIT_LG } from '@/src/shared/constants/limits'

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

export async function buildXlsx(rows: Record<string, unknown>[], jobType: JobType): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  const sheetTitle = JOB_LABELS[jobType]
  const sheet = workbook.addWorksheet(sheetTitle)

  if (rows.length === 0) {
    sheet.addRow(['Bilgi'])
    sheet.addRow(['Veri bulunamadı'])
    const buffer = await workbook.xlsx.writeBuffer()
    return Buffer.from(buffer)
  }

  // Başlık satırı
  const headers = Object.keys(rows[0])
  sheet.addRow(headers)
  const headerRow = sheet.getRow(1)
  headerRow.font = { bold: true }
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFD9EAD3' },
  }

  // Veri satırları
  for (const row of rows) {
    sheet.addRow(headers.map(h => row[h]))
  }

  // Kolon genişlikleri — ilk 50 satıra göre otomatik
  sheet.columns.forEach((col, i) => {
    const header = headers[i] ?? ''
    const maxDataLen = rows.slice(0, 50).reduce((max, row) => {
      return Math.max(max, String(row[header] ?? '').length)
    }, 0)
    col.width = Math.min(50, Math.max(12, header.length, maxDataLen) + 2)
  })

  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
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
    .select('id, title, subject, due_date, classes(name)')
    .eq('school_id', schoolId)
    .is('deleted_at', null)
    .order('due_date', { ascending: false })
    .limit(XLSX_EXPORT_LIMIT)

  if (params.classId) { UUID.parse(params.classId); q = q.eq('class_id', params.classId) }
  if (params.since) {
    if (!DATE_RE.test(params.since)) throw new Error('Geçersiz tarih formatı: since')
    q = q.gte('due_date', params.since)
  }
  if (params.until) {
    if (!DATE_RE.test(params.until)) throw new Error('Geçersiz tarih formatı: until')
    q = q.lte('due_date', params.until)
  }

  const { data: hwData, error: hwErr } = await q
  if (hwErr) throw new Error(`Ödevler sorgu hatası: ${hwErr.message}`)

  const homeworks = hwData ?? []
  const hwIds = homeworks.map(h => h.id)

  const subMap = new Map<string, { yapildi: number; eksik: number; yapilmadi: number; gec: number; mazeretli: number; toplam: number }>()
  for (const id of hwIds) subMap.set(id, { yapildi: 0, eksik: 0, yapilmadi: 0, gec: 0, mazeretli: 0, toplam: 0 })

  if (hwIds.length > 0) {
    const { data: subData, error: subErr } = await db
      .from('homework_submissions')
      .select('homework_id, status')
      .in('homework_id', hwIds)
      .limit(XLSX_EXPORT_LIMIT * 60)
    if (subErr) throw new Error(`Teslim sorgu hatası: ${subErr.message}`)
    for (const s of subData ?? []) {
      const e = subMap.get(s.homework_id)
      if (!e) continue
      e.toplam++
      if      (s.status === 'yapildi')   e.yapildi++
      else if (s.status === 'eksik')     e.eksik++
      else if (s.status === 'yapilmadi') e.yapilmadi++
      else if (s.status === 'gec')       e.gec++
      else if (s.status === 'mazeretli') e.mazeretli++
    }
  }

  return homeworks.map(h => {
    const s = subMap.get(h.id)!
    return {
      'Sınıf':      h.classes?.name ?? '—',
      'Ders':       h.subject,
      'Ödev':       h.title,
      'Son Tarih':  h.due_date ? fmtDate(h.due_date) : '—',
      'Yapıldı':    s.yapildi,
      'Eksik':      s.eksik,
      'Yapılmadı':  s.yapilmadi,
      'Geç':        s.gec,
      'Mazeretli':  s.mazeretli,
      'Toplam':     s.toplam,
    }
  })
}

async function fetchNotlar(schoolId: string) {
  const db = createServiceClient()
  const { data, error } = await db
    .from('student_notes')
    .select('body, created_at, students(full_name, student_number, deleted_at, classes(name))')
    .eq('school_id', schoolId)
    .order('created_at', { ascending: true })
    .limit(5000)
  if (error) throw new Error(`Notlar sorgu hatası: ${error.message}`)

  type StudentRow = { full_name: string; student_number: string | null; deleted_at: string | null; classes: { name: string } | null }

  const rows = (data ?? [])
    .filter(n => {
      const s = n.students as StudentRow | null
      return !s?.deleted_at
    })
    .map(n => {
      const s = n.students as StudentRow | null
      return {
        className:  s?.classes?.name ?? '',
        full_name:  s?.full_name ?? '—',
        student_number: s?.student_number ?? null,
        body:       n.body,
        created_at: n.created_at,
      }
    })

  rows.sort((a, b) => {
    const cls = a.className.localeCompare(b.className, 'tr')
    if (cls !== 0) return cls
    return a.full_name.localeCompare(b.full_name, 'tr')
  })

  return rows.map(n => ({
    'Sınıf':    n.className || '—',
    'No':       n.student_number ?? '—',
    'Ad Soyad': n.full_name,
    'Not':      n.body,
    'Tarih':    n.created_at ? fmtDate(n.created_at.split('T')[0]) : '—',
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
    .limit(XLSX_EXPORT_LIMIT_LG)

  if (params.classId) { UUID.parse(params.classId); q = q.eq('class_id', params.classId) }

  const { data, error } = await q
  if (error) throw new Error(`Öğrenciler sorgu hatası: ${error.message}`)

  const rows = (data ?? []).map(s => ({
    className: s.classes?.name ?? '',
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
    const student = r.students
    const cls     = r.classes
    return {
      'Sınıf':    cls?.name ?? '—',
      'No':       student?.student_number ?? '—',
      'Ad Soyad': student?.full_name ?? '—',
      'Tarih':    fmtDate(r.date),
      'Durum':    STATUS_LABELS[r.status] ?? r.status,
    }
  })
}

