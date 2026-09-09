'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { StudyPlanService } from '@/src/domains/studyPlan/services/StudyPlanService'
import { PLAN_STATUSES } from '@/src/domains/studyPlan/planMath'
import type { ActionResult } from '@/src/shared/types'

const ISO = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Geçersiz tarih')
const uuid = (msg: string) => z.string().uuid(msg)

const addSchema = z.object({
  studentId:   uuid('Geçersiz öğrenci'),
  weekStart:   ISO,
  planDate:    ISO.nullish(),
  source:      z.string().trim().max(120, 'Kaynak en fazla 120 karakter').nullish(),
  description: z.string().trim().min(1, 'Talimat boş olamaz').max(300, 'Talimat en fazla 300 karakter'),
})
const updateSchema = z.object({
  id:          uuid('Geçersiz madde'),
  description: z.string().trim().min(1, 'Talimat boş olamaz').max(300, 'Talimat en fazla 300 karakter').optional(),
  source:      z.string().trim().max(120, 'Kaynak en fazla 120 karakter').nullable().optional(),
  planDate:    ISO.nullable().optional(),
  status:      z.enum(PLAN_STATUSES as [string, ...string[]]).optional(),
  note:        z.string().trim().max(300, 'Not en fazla 300 karakter').nullable().optional(),
})
const copySchema   = z.object({ studentId: uuid('Geçersiz öğrenci'), weekStart: ISO })
const sourceSchema = z.object({ studentId: uuid('Geçersiz öğrenci'), name: z.string().trim().min(1, 'Kaynak adı boş olamaz').max(120, 'Kaynak adı en fazla 120 karakter') })
const idSchema     = uuid('Geçersiz kimlik')

function revalidate() {
  revalidatePath('/siniflar/[id]/plan', 'page')
  revalidatePath('/siniflar/[id]/ogrenciler/[studentId]', 'page')
}
function invalid(e: z.ZodError) { return { error: e.issues[0]?.message ?? 'Geçersiz veri' } }

export async function addPlanItem(input: unknown): Promise<ActionResult<{ id?: string }>> {
  const p = addSchema.safeParse(input)
  if (!p.success) return invalid(p.error)
  const r = await StudyPlanService.addItem({
    studentId: p.data.studentId, weekStart: p.data.weekStart,
    planDate: p.data.planDate ?? null, source: p.data.source || null, description: p.data.description,
  })
  if (r.error) return { error: r.error }
  revalidate()
  return { id: r.id }
}

export async function updatePlanItem(input: unknown): Promise<ActionResult> {
  const p = updateSchema.safeParse(input)
  if (!p.success) return invalid(p.error)
  const { id, status, ...rest } = p.data
  const r = await StudyPlanService.updateItem(id, { ...rest, status: status as (typeof PLAN_STATUSES)[number] | undefined })
  if (r.error) return { error: r.error }
  revalidate()
  return {}
}

export async function deletePlanItem(id: unknown): Promise<ActionResult> {
  const p = idSchema.safeParse(id)
  if (!p.success) return invalid(p.error)
  const r = await StudyPlanService.deleteItem(p.data)
  if (r.error) return { error: r.error }
  revalidate()
  return {}
}

export async function copyPreviousWeekPlan(input: unknown): Promise<ActionResult<{ count?: number }>> {
  const p = copySchema.safeParse(input)
  if (!p.success) return invalid(p.error)
  const r = await StudyPlanService.copyPreviousWeek(p.data.studentId, p.data.weekStart)
  if (r.error) return { error: r.error }
  revalidate()
  return { count: r.count }
}

export async function addStudentSource(input: unknown): Promise<ActionResult<{ id?: string }>> {
  const p = sourceSchema.safeParse(input)
  if (!p.success) return invalid(p.error)
  const r = await StudyPlanService.addSource(p.data.studentId, p.data.name)
  if (r.error) return { error: r.error }
  revalidate()
  return { id: r.id }
}

export async function removeStudentSource(id: unknown): Promise<ActionResult> {
  const p = idSchema.safeParse(id)
  if (!p.success) return invalid(p.error)
  const r = await StudyPlanService.removeSource(p.data)
  if (r.error) return { error: r.error }
  revalidate()
  return {}
}
