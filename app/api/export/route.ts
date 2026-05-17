/**
 * POST /api/export  — create + process export job (XLSX → Supabase Storage → signed URL)
 * GET  /api/export?jobId=  — poll job status
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser, requireSchoolId } from '@/lib/auth'
import { UUID } from '@/lib/validation'
import type { JobType } from '@/lib/jobs'
import * as XLSX from 'xlsx'

const ALLOWED_JOB_TYPES: JobType[] = [
  'excel_odevler',
  'excel_yoklama',
  'excel_mufredat',
  'excel_notlar',
]

// ─── POST — create + process job ─────────────────────────────

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { jobType?: string; params?: Record<string, string> }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Geçersiz JSON' }, { status: 400 })
  }

  const jobType = body.jobType as JobType
  if (!ALLOWED_JOB_TYPES.includes(jobType)) {
    return NextResponse.json({ error: 'Geçersiz iş türü' }, { status: 400 })
  }

  const params = body.params ?? {}

  let school_id: string
  try {
    school_id = await requireSchoolId()
  } catch {
    return NextResponse.json({ error: 'Okul bilgisi eksik' }, { status: 403 })
  }

  const supabase = await createClient()

  const { data: job, error: createErr } = await supabase
    .from('export_jobs')
    .insert({ school_id, user_id: user.id, job_type: jobType, params, status: 'processing' })
    .select('id')
    .single()

  if (createErr || !job) {
    return NextResponse.json({ error: createErr?.message ?? 'İş oluşturulamadı' }, { status: 500 })
  }

  const jobId: string = job.id

  try {
    const { url, filename } = await processExportJob(jobType, params, user.id, school_id, supabase)
    await supabase
      .from('export_jobs')
      .update({ status: 'done', result_url: url, updated_at: new Date().toISOString() })
      .eq('id', jobId)

    return NextResponse.json({ jobId, status: 'done', url, filename })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'İşlem hatası'
    await supabase
      .from('export_jobs')
      .update({ status: 'error', error_msg: msg, updated_at: new Date().toISOString() })
      .eq('id', jobId)

    return NextResponse.json({ jobId, status: 'error', error: msg }, { status: 500 })
  }
}

// ─── GET — poll job status ────────────────────────────────────

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const jobId = req.nextUrl.searchParams.get('jobId')
  if (!jobId) return NextResponse.json({ error: 'jobId gerekli' }, { status: 400 })

  try { UUID.parse(jobId) } catch {
    return NextResponse.json({ error: 'Geçersiz jobId' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('export_jobs')
    .select('id, status, result_url, error_msg, job_type, created_at, updated_at')
    .eq('id', jobId)
    .eq('user_id', user.id)
    .single()

  if (error || !data) return NextResponse.json({ error: 'İş bulunamadı' }, { status: 404 })
  return NextResponse.json(data)
}

// ─── Job processor ───────────────────────────────────────────

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

const JOB_LABELS: Record<JobType, string> = {
  excel_odevler: 'Ödevler',
  excel_yoklama: 'Yoklama',
  excel_mufredat: 'Müfredat',
  excel_notlar: 'Öğrenci Notları',
}

async function processExportJob(
  jobType: JobType,
  params: Record<string, string>,
  userId: string,
  school_id: string,
  supabase: SupabaseClient
): Promise<{ url: string; filename: string }> {
  let rows: Record<string, unknown>[]

  switch (jobType) {
    case 'excel_odevler':  rows = await fetchOdevler(supabase, params, school_id); break
    case 'excel_yoklama':  rows = await fetchYoklama(supabase, params, school_id); break
    case 'excel_mufredat': rows = await fetchMufredat(supabase, params, school_id); break
    case 'excel_notlar':   rows = await fetchNotlar(supabase, school_id); break
    default: throw new Error('Bilinmeyen iş türü')
  }

  const sheetName = JOB_LABELS[jobType]
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ 'Bilgi': 'Veri bulunamadı' }])

  // Column width auto-fit
  const maxWidths = rows.length
    ? Object.keys(rows[0]).map(k =>
        Math.min(
          50,
          Math.max(k.length, ...rows.slice(0, 50).map(r => String(r[k] ?? '').length))
        )
      )
    : [20]
  ws['!cols'] = maxWidths.map(w => ({ wch: w }))

  XLSX.utils.book_append_sheet(wb, ws, sheetName)

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer

  const date = new Date().toISOString().split('T')[0]
  const filename = `${jobType}-${date}.xlsx`
  const storagePath = `${userId}/${filename}`

  const { error: uploadErr } = await supabase.storage
    .from('exports')
    .upload(storagePath, buffer, {
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      upsert: true,
    })

  if (uploadErr) throw new Error(`Storage upload hatası: ${uploadErr.message}`)

  const { data: signed } = await supabase.storage
    .from('exports')
    .createSignedUrl(storagePath, 3600) // 1 saatlik link

  if (!signed?.signedUrl) throw new Error('Signed URL oluşturulamadı')

  return { url: signed.signedUrl, filename }
}

// ─── Data fetchers ────────────────────────────────────────────

async function fetchOdevler(supabase: SupabaseClient, params: Record<string, string>, school_id: string) {
  let q = supabase
    .from('homeworks')
    .select('title, subject, due_date, classes(name)')
    .eq('school_id', school_id)
    .order('due_date', { ascending: false })
    .limit(2000)

  if (params.classId) { try { UUID.parse(params.classId); q = q.eq('class_id', params.classId) } catch { /**/ } }
  if (params.since) q = q.gte('due_date', params.since)
  if (params.until) q = q.lte('due_date', params.until)

  const { data } = await q
  return (data ?? []).map(h => ({
    'Ödev Başlığı': h.title,
    'Ders': h.subject,
    'Son Tarih': h.due_date,
    'Sınıf': (h.classes as unknown as { name: string } | null)?.name ?? '—',
  }))
}

async function fetchYoklama(supabase: SupabaseClient, params: Record<string, string>, school_id: string) {
  const since = params.since ?? new Date(Date.now() - 30 * 86400_000).toISOString().split('T')[0]
  const statusLabel: Record<string, string> = {
    present: 'Var', absent: 'Yok', late: 'Geç', excused: 'Mazeretli',
  }

  let query = supabase
    .from('attendance')
    .select('date, status, students(full_name, student_number), classes(name)')
    .eq('school_id', school_id)
    .gte('date', since)
    .order('date', { ascending: false })
    .limit(1000)

  if (params.classId) { try { UUID.parse(params.classId); query = query.eq('class_id', params.classId) } catch { /**/ } }
  if (params.until) query = query.lte('date', params.until)

  const { data } = await query
  return (data ?? []).map(r => {
    const student = r.students as unknown as { full_name: string; student_number: string | null } | null
    const cls = r.classes as unknown as { name: string } | null
    return {
      'Tarih': r.date,
      'Sınıf': cls?.name ?? '—',
      'Öğrenci': student?.full_name ?? '—',
      'No': student?.student_number ?? '—',
      'Durum': statusLabel[r.status] ?? r.status,
    }
  })
}

async function fetchMufredat(supabase: SupabaseClient, params: Record<string, string>, school_id: string) {
  const statusLabel: Record<string, string> = {
    tamamlandi: 'Tamamlandı', eksik_kaldi: 'Eksik Kaldı', islenmedi: 'İşlenmedi',
  }
  let q = supabase
    .from('curriculum_progress')
    .select('topic, status, week_number, completion_date, classes(name)')
    .eq('school_id', school_id)
    .order('week_number', { ascending: true })
    .limit(2000)

  if (params.classId) { try { UUID.parse(params.classId); q = q.eq('class_id', params.classId) } catch { /**/ } }

  const { data } = await q

  return (data ?? []).map(p => ({
    'Konu': p.topic,
    'Sınıf': (p.classes as unknown as { name: string } | null)?.name ?? '—',
    'Hafta': p.week_number ?? '—',
    'Durum': statusLabel[p.status] ?? p.status,
    'Tamamlanma Tarihi': p.completion_date ?? '—',
  }))
}

async function fetchNotlar(supabase: SupabaseClient, school_id: string) {
  const { data } = await supabase
    .from('student_notes')
    .select('body, created_at, students(full_name)')
    .eq('school_id', school_id)
    .order('created_at', { ascending: false })
    .limit(2000)

  return (data ?? []).map(n => ({
    'Öğrenci': (n.students as unknown as { full_name: string } | null)?.full_name ?? '—',
    'Not': n.body,
    'Tarih': n.created_at?.split('T')[0] ?? '—',
  }))
}
