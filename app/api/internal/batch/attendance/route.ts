import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withInternalAuth } from '@/src/infrastructure/api/middleware'
import { parseBody } from '@/src/infrastructure/api/validation'
import { apiOk, apiErr } from '@/src/infrastructure/api/response'
import { createClient } from '@/src/infrastructure/supabase/server'
import { P } from '@/src/shared/permissions'

// ─── Schema ───────────────────────────────────────────────────────────────────

const StatusEnum = z.enum(['present', 'absent', 'late', 'excused'])

const BatchAttendanceSchema = z.object({
  class_id:       z.string().uuid('Geçersiz sınıf kimliği'),
  date:           z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Tarih YYYY-MM-DD formatında olmalı'),
  default_status: StatusEnum,
  overrides: z.array(z.object({
    student_id: z.string().uuid(),
    status:     StatusEnum,
  })).max(500).optional().default([]),
})

// ─── POST /api/internal/batch/attendance ──────────────────────────────────────
//
// Bir sınıfın tüm öğrencilerini default_status ile işaretler.
// overrides listesindeki öğrenciler bireysel statüyle geçersiz kılar.
// Tek upsert round-trip — form tabanlı yoklamadan çok daha hızlı.

export const POST = withInternalAuth(P.ATTENDANCE.CREATE, async (req, ctx) => {
  const parsed = await parseBody(req, BatchAttendanceSchema)
  if (!parsed.success) return NextResponse.json(apiErr('VALIDATION_ERROR', parsed.error, ctx), { status: 400 })

  const { class_id, date, default_status, overrides } = parsed.data
  const { schoolId, userId } = ctx.ability
  const supabase = await createClient()

  const { data: students, error: studentsErr } = await supabase
    .from('students')
    .select('id')
    .eq('class_id', class_id)
    .eq('school_id', schoolId)
    .is('deleted_at', null)

  if (studentsErr) return NextResponse.json(apiErr('DB_ERROR', studentsErr.message, ctx), { status: 500 })
  if (!students || students.length === 0) {
    return NextResponse.json(apiErr('NOT_FOUND', 'Sınıfta öğrenci bulunamadı', ctx), { status: 404 })
  }

  const overrideMap = new Map(
    overrides.map((o: { student_id: string; status: string }) => [o.student_id, o.status] as const)
  )

  const rows = students.map(s => ({
    teacher_id: userId,
    class_id,
    student_id: s.id,
    date,
    status:    overrideMap.get(s.id) ?? default_status,
    school_id: schoolId,
  }))

  const { error: upsertErr } = await supabase
    .from('attendance')
    .upsert(rows, { onConflict: 'class_id,student_id,date' })

  if (upsertErr) return NextResponse.json(apiErr('DB_ERROR', upsertErr.message, ctx), { status: 500 })

  return NextResponse.json(apiOk({
    processed:  rows.length,
    overridden: overrides.length,
    classId:    class_id,
    date,
  }, ctx))
})
