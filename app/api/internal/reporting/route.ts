import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withInternalAuth } from '@/src/infrastructure/api/middleware'
import { parseSearchParams } from '@/src/infrastructure/api/validation'
import { apiOk, apiErr } from '@/src/infrastructure/api/response'
import { createClient } from '@/src/infrastructure/supabase/server'
import { trackedQuery } from '@/src/infrastructure/observability/slow-query'

// ─── Schema ───────────────────────────────────────────────────────────────────

const QuerySchema = z.object({
  type:       z.enum(['class', 'teacher', 'student']),
  class_id:   z.string().uuid().optional(),
  teacher_id: z.string().uuid().optional(),
  student_id: z.string().uuid().optional(),
  period:     z.enum(['7d', '30d', '90d']).default('30d'),
})

const PERIOD_DAYS: Record<string, number> = { '7d': 7, '30d': 30, '90d': 90 }

function isoDateAgo(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().split('T')[0]
}

// ─── GET /api/internal/reporting?type=class|teacher|student&... ───────────────

export const GET = withInternalAuth(null, async (req, ctx) => {
  const parsed = parseSearchParams(req, QuerySchema)
  if (!parsed.success) return NextResponse.json(apiErr('VALIDATION_ERROR', parsed.error, ctx), { status: 400 })

  const { type, period, class_id, teacher_id, student_id } = parsed.data
  const since      = isoDateAgo(PERIOD_DAYS[period])
  const { schoolId } = ctx.ability
  const supabase   = await createClient()

  // ── class report ────────────────────────────────────────────────────────────
  if (type === 'class') {
    if (!class_id) return NextResponse.json(apiErr('VALIDATION_ERROR', 'class_id gerekli', ctx), { status: 400 })

    // Fetch homework IDs first — PostgREST doesn't support subqueries in .in()
    const { data: hwRows } = await trackedQuery('reporting.class.hwIds', async () =>
      supabase
        .from('homeworks')
        .select('id')
        .eq('class_id', class_id)
        .eq('school_id', schoolId)
        .is('deleted_at', null)
    )

    const hwIds = (hwRows ?? []).map(r => r.id)

    const [hwRes, attRes, studentRes] = await Promise.all([
      hwIds.length > 0
        ? supabase.from('homework_submissions')
            .select('student_id, status')
            .eq('school_id', schoolId)
            .in('homework_id', hwIds)
            .gte('updated_at', since)
        : Promise.resolve({ data: [] as { student_id: string; status: string }[] }),

      supabase.from('attendance')
        .select('student_id, status')
        .eq('class_id', class_id)
        .eq('school_id', schoolId)
        .gte('date', since),

      supabase.from('students')
        .select('id, full_name, student_number')
        .eq('class_id', class_id)
        .eq('school_id', schoolId)
        .is('deleted_at', null)
        .order('full_name'),
    ])

    const hwMap  = new Map<string, { total: number; done: number }>()
    const attMap = new Map<string, { total: number; present: number }>()

    for (const s of (hwRes.data ?? [])) {
      const e = hwMap.get(s.student_id) ?? { total: 0, done: 0 }
      e.total++
      if (s.status === 'yapildi') e.done++
      hwMap.set(s.student_id, e)
    }
    for (const a of (attRes.data ?? [])) {
      const e = attMap.get(a.student_id) ?? { total: 0, present: 0 }
      e.total++
      if (a.status === 'present') e.present++
      attMap.set(a.student_id, e)
    }

    const rows = (studentRes.data ?? []).map(s => {
      const hw  = hwMap.get(s.id)
      const att = attMap.get(s.id)
      return {
        studentId:     s.id,
        fullName:      s.full_name,
        studentNumber: s.student_number,
        homework:   hw  ? { rate: Math.round((hw.done / hw.total)     * 100), done: hw.done,     total: hw.total  } : null,
        attendance: att ? { rate: Math.round((att.present / att.total) * 100), present: att.present, total: att.total } : null,
      }
    })

    return NextResponse.json(apiOk({ type, classId: class_id, period, since, rows }, ctx))
  }

  // ── teacher report ───────────────────────────────────────────────────────────
  if (type === 'teacher') {
    const targetId = teacher_id ?? ctx.ability.userId

    // Fetch IDs first for the submissions subquery
    const { data: hwCreated } = await trackedQuery('reporting.teacher.hwIds', async () =>
      supabase
        .from('homeworks')
        .select('id')
        .eq('teacher_id', targetId)
        .eq('school_id', schoolId)
        .is('deleted_at', null)
        .gte('created_at', since)
    )

    const hwIds = (hwCreated ?? []).map(r => r.id)

    const [hwListRes, submissionsRes, attCountRes] = await Promise.all([
      supabase.from('homeworks')
        .select('id, title, due_date, created_at')
        .eq('teacher_id', targetId)
        .eq('school_id', schoolId)
        .is('deleted_at', null)
        .gte('created_at', since)
        .order('created_at', { ascending: false }),

      hwIds.length > 0
        ? supabase.from('homework_submissions')
            .select('status')
            .eq('school_id', schoolId)
            .in('homework_id', hwIds)
            .gte('updated_at', since)
        : Promise.resolve({ data: [] as { status: string }[] }),

      supabase.from('attendance')
        .select('*', { count: 'exact', head: true })
        .eq('teacher_id', targetId)
        .eq('school_id', schoolId)
        .gte('date', since),
    ])

    const submissions = submissionsRes.data ?? []
    const totalSub    = submissions.length
    const doneSub     = submissions.filter(s => s.status === 'yapildi').length

    return NextResponse.json(apiOk({
      type,
      teacherId: targetId,
      period,
      since,
      homeworks: {
        created: hwListRes.data?.length ?? 0,
        list:    hwListRes.data ?? [],
      },
      submissions: {
        total:          totalSub,
        done:           doneSub,
        completionRate: totalSub > 0 ? Math.round((doneSub / totalSub) * 100) : null,
      },
      attendanceDaysLogged: attCountRes.count ?? 0,
    }, ctx))
  }

  // ── student report ───────────────────────────────────────────────────────────
  if (type === 'student') {
    if (!student_id) return NextResponse.json(apiErr('VALIDATION_ERROR', 'student_id gerekli', ctx), { status: 400 })

    const [hwRes, attRes, notesRes] = await Promise.all([
      supabase.from('homework_submissions')
        .select('status, updated_at, homework_id')
        .eq('student_id', student_id)
        .eq('school_id', schoolId)
        .gte('updated_at', since)
        .order('updated_at', { ascending: false }),

      trackedQuery('reporting.student.attendance', async () =>
        supabase.from('attendance')
          .select('date, status')
          .eq('student_id', student_id)
          .eq('school_id', schoolId)
          .gte('date', since)
          .order('date', { ascending: false })
      ),

      supabase.from('student_notes')
        .select('body, created_at')
        .eq('student_id', student_id)
        .eq('school_id', schoolId)
        .order('created_at', { ascending: false })
        .limit(10),
    ])

    const submissions = hwRes.data  ?? []
    const attRecords  = attRes.data ?? []
    const totalHW     = submissions.length
    const doneHW      = submissions.filter(s => s.status === 'yapildi').length
    const totalAtt    = attRecords.length
    const presentAtt  = attRecords.filter(a => a.status === 'present').length

    return NextResponse.json(apiOk({
      type,
      studentId: student_id,
      period,
      since,
      homework: {
        completionRate: totalHW > 0 ? Math.round((doneHW / totalHW) * 100) : null,
        done:  doneHW,
        total: totalHW,
        list:  submissions,
      },
      attendance: {
        rate:    totalAtt > 0 ? Math.round((presentAtt / totalAtt) * 100) : null,
        present: presentAtt,
        total:   totalAtt,
        records: attRecords,
      },
      recentNotes: notesRes.data ?? [],
    }, ctx))
  }

  return NextResponse.json(apiErr('VALIDATION_ERROR', 'Geçersiz rapor türü', ctx), { status: 400 })
})
