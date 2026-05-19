import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withInternalAuth } from '@/src/infrastructure/api/middleware'
import { parseSearchParams } from '@/src/infrastructure/api/validation'
import { apiOk, apiErr } from '@/src/infrastructure/api/response'
import { createClient } from '@/src/infrastructure/supabase/server'

// ─── Schema ───────────────────────────────────────────────────────────────────

const QuerySchema = z.object({
  period: z.enum(['7d', '30d', '90d']).default('30d'),
})

const PERIOD_DAYS: Record<string, number> = { '7d': 7, '30d': 30, '90d': 90 }

function isoDateAgo(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().split('T')[0]
}

// ─── GET /api/internal/analytics?period=7d|30d|90d ───────────────────────────
//
// Okul genelinde özet istatistikler. schoolId ile sınırlandırılır.

export const GET = withInternalAuth(null, async (req, ctx) => {
  const parsed = parseSearchParams(req, QuerySchema)
  if (!parsed.success) return NextResponse.json(apiErr('VALIDATION_ERROR', parsed.error, ctx), { status: 400 })

  const since      = isoDateAgo(PERIOD_DAYS[parsed.data.period])
  const { schoolId } = ctx.ability
  const supabase   = await createClient()

  const [
    totalHW, doneHW,
    totalAtt, presentAtt,
    activeTeacherRows,
    atRiskRes,
  ] = await Promise.all([
    supabase.from('homework_submissions')
      .select('*', { count: 'exact', head: true })
      .eq('school_id', schoolId).gte('updated_at', since),

    supabase.from('homework_submissions')
      .select('*', { count: 'exact', head: true })
      .eq('school_id', schoolId).eq('status', 'yapildi').gte('updated_at', since),

    supabase.from('attendance')
      .select('*', { count: 'exact', head: true })
      .eq('school_id', schoolId).gte('date', since),

    supabase.from('attendance')
      .select('*', { count: 'exact', head: true })
      .eq('school_id', schoolId).eq('status', 'present').gte('date', since),

    supabase.from('homeworks')
      .select('teacher_id')
      .eq('school_id', schoolId)
      .is('deleted_at', null)
      .gte('created_at', since),

    supabase.rpc('at_risk_student_count', {
      p_school_id: schoolId,
      p_since:     since,
    }),
  ])

  const totalHWCount = totalHW.count ?? 0
  const doneHWCount  = doneHW.count  ?? 0
  const hwRate       = totalHWCount > 0 ? Math.round((doneHWCount / totalHWCount) * 100) : null

  const totalAttCount   = totalAtt.count   ?? 0
  const presentAttCount = presentAtt.count ?? 0
  const attRate         = totalAttCount > 0 ? Math.round((presentAttCount / totalAttCount) * 100) : null

  const activeTeachers = new Set((activeTeacherRows.data ?? []).map(r => r.teacher_id)).size

  const atRiskStudents = (atRiskRes.data as number | null) ?? 0

  return NextResponse.json(apiOk({
    period:  parsed.data.period,
    since,
    homework: {
      completionRate: hwRate,
      total:          totalHWCount,
      done:           doneHWCount,
    },
    attendance: {
      rate:    attRate,
      total:   totalAttCount,
      present: presentAttCount,
    },
    activeTeachers,
    atRiskStudents,
  }, ctx))
})
