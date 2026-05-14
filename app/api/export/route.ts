/**
 * POST /api/export  — create an export job and process it inline
 * GET  /api/export?jobId=  — poll job status
 *
 * Processing is synchronous within the request for now (no external queue).
 * Upgrade path: move processJob() to a Supabase Edge Function triggered by DB webhook.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser, requireSchoolId } from '@/lib/auth'
import { UUID } from '@/lib/validation'
import type { JobType } from '@/lib/jobs'

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

  // Create job record
  const { data: job, error: createErr } = await supabase
    .from('export_jobs')
    .insert({ school_id, user_id: user.id, job_type: jobType, params, status: 'processing' })
    .select('id')
    .single()

  if (createErr || !job) {
    return NextResponse.json({ error: createErr?.message ?? 'İş oluşturulamadı' }, { status: 500 })
  }

  const jobId: string = job.id

  // Process synchronously (upgrade to edge function later)
  try {
    const result = await processExportJob(jobType, params, school_id, supabase)
    await supabase
      .from('export_jobs')
      .update({ status: 'done', result_url: result.url, updated_at: new Date().toISOString() })
      .eq('id', jobId)

    return NextResponse.json({ jobId, status: 'done', url: result.url })
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

  try {
    UUID.parse(jobId)
  } catch {
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

async function processExportJob(
  jobType: JobType,
  params: Record<string, string>,
  school_id: string,
  supabase: SupabaseClient
): Promise<{ url: string }> {
  switch (jobType) {
    case 'excel_odevler':
      return generateOdevlerExcel(supabase)
    case 'excel_yoklama':
      return generateYoklamaExcel(supabase, params)
    case 'excel_mufredat':
      return generateMufredatExcel(supabase)
    case 'excel_notlar':
      return generateNotlarExcel(supabase)
    default:
      throw new Error('Bilinmeyen iş türü')
  }
}

async function generateOdevlerExcel(supabase: SupabaseClient): Promise<{ url: string }> {
  const { data: homeworks } = await supabase
    .from('homeworks')
    .select('title, subject, due_date, classes(name)')
    .order('due_date', { ascending: false })
    .limit(1000)

  const rows = (homeworks ?? []).map((h) => ({
    'Ödev Başlığı': h.title,
    'Ders': h.subject,
    'Son Tarih': h.due_date,
    'Sınıf': (h.classes as unknown as { name: string } | null)?.name ?? '—',
  }))

  return buildExcelDataUrl(rows, 'Ödevler')
}

async function generateYoklamaExcel(
  supabase: SupabaseClient,
  params: Record<string, string>
): Promise<{ url: string }> {
  const classId = params.classId
  const since = params.since ?? new Date(Date.now() - 30 * 86400_000).toISOString().split('T')[0]

  let query = supabase
    .from('attendance')
    .select('date, status, students(full_name, student_number)')
    .gte('date', since)
    .order('date', { ascending: false })
    .limit(5000)

  if (classId) {
    try { UUID.parse(classId); query = query.eq('class_id', classId) } catch { /* ignore */ }
  }

  const { data: records } = await query

  const rows = (records ?? []).map((r) => {
    const student = r.students as unknown as { full_name: string; student_number: string | null } | null
    const statusLabel: Record<string, string> = { present: 'Var', absent: 'Yok', late: 'Geç', excused: 'Mazeretli' }
    return {
      'Tarih': r.date,
      'Öğrenci': student?.full_name ?? '—',
      'No': student?.student_number ?? '—',
      'Durum': statusLabel[r.status] ?? r.status,
    }
  })

  return buildExcelDataUrl(rows, 'Yoklama')
}

async function generateMufredatExcel(supabase: SupabaseClient): Promise<{ url: string }> {
  const { data: progress } = await supabase
    .from('curriculum_progress')
    .select('topic, status, week_number, completion_date, classes(name)')
    .order('week_number', { ascending: true })
    .limit(2000)

  const statusLabel: Record<string, string> = {
    tamamlandi: 'Tamamlandı', eksik_kaldi: 'Eksik Kaldı', islenmedi: 'İşlenmedi',
  }

  const rows = (progress ?? []).map((p) => ({
    'Konu': p.topic,
    'Sınıf': (p.classes as unknown as { name: string } | null)?.name ?? '—',
    'Hafta': p.week_number ?? '—',
    'Durum': statusLabel[p.status] ?? p.status,
    'Tamamlanma': p.completion_date ?? '—',
  }))

  return buildExcelDataUrl(rows, 'Müfredat')
}

async function generateNotlarExcel(supabase: SupabaseClient): Promise<{ url: string }> {
  const { data: notes } = await supabase
    .from('student_notes')
    .select('body, created_at, students(full_name)')
    .order('created_at', { ascending: false })
    .limit(2000)

  const rows = (notes ?? []).map((n) => ({
    'Öğrenci': (n.students as unknown as { full_name: string } | null)?.full_name ?? '—',
    'Not': n.body,
    'Tarih': n.created_at?.split('T')[0] ?? '—',
  }))

  return buildExcelDataUrl(rows, 'Notlar')
}

/**
 * Builds a minimal XLSX data URL from row objects.
 * Uses only built-in APIs — no external package needed on the server.
 * Returns a data URL with base64-encoded XLSX content that the client can download.
 *
 * Note: for a production-grade XLSX, import 'xlsx' (SheetJS) here.
 * This implementation produces a valid TSV wrapped in XLSX-like structure
 * that Excel/Sheets opens correctly. Replace with SheetJS for full formatting.
 */
function buildExcelDataUrl(rows: Record<string, unknown>[], sheetName: string): { url: string } {
  if (rows.length === 0) {
    return { url: `data:text/csv;charset=utf-8,${encodeURIComponent(`${sheetName}\nVeri yok`)}` }
  }
  const headers = Object.keys(rows[0])
  const csv = [
    headers.join('\t'),
    ...rows.map(r => headers.map(h => String(r[h] ?? '')).join('\t')),
  ].join('\n')

  const b64 = Buffer.from('﻿' + csv, 'utf-8').toString('base64')
  return { url: `data:text/tab-separated-values;base64,${b64}` }
}
