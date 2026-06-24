'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { TaskService, type Task } from '@/src/domains/tasks/services/TaskService'
import type { ActionResult } from '@/src/shared/types/index'

const createSchema = z.object({
  title: z.string().trim().min(1, 'Görev metni zorunludur').max(200, 'Görev en fazla 200 karakter olabilir'),
  studentId: z.string().uuid().nullish(),
  classId: z.string().uuid().nullish(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Geçersiz tarih').nullish(),
})

const snoozeSchema = z.object({
  id: z.string().uuid('Geçersiz görev kimliği'),
  option: z.enum(['tomorrow', 'nextWeek']),
})

const idSchema = z.string().uuid('Geçersiz görev kimliği')

// Yeni görev ekler; başarıda eklenen görevi (id'li) döndürür.
export async function createTask(input: unknown): Promise<ActionResult<{ task?: Task }>> {
  const parsed = createSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Geçersiz veri' }

  const result = await TaskService.addTask({
    title: parsed.data.title,
    studentId: parsed.data.studentId ?? null,
    classId: parsed.data.classId ?? null,
    dueDate: parsed.data.dueDate ?? null,
  })
  if (result.error) return { error: result.error }

  revalidatePath('/anasayfa')
  return { task: result.task }
}

export async function completeTask(id: unknown): Promise<ActionResult> {
  const parsed = idSchema.safeParse(id)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Geçersiz veri' }
  const result = await TaskService.completeTask(parsed.data)
  if (result.error) return { error: result.error }
  revalidatePath('/anasayfa')
  return {}
}

export async function reopenTask(id: unknown): Promise<ActionResult> {
  const parsed = idSchema.safeParse(id)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Geçersiz veri' }
  const result = await TaskService.reopenTask(parsed.data)
  if (result.error) return { error: result.error }
  revalidatePath('/anasayfa')
  return {}
}

export async function snoozeTask(input: unknown): Promise<ActionResult> {
  const parsed = snoozeSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Geçersiz veri' }
  const result = await TaskService.snoozeTask(parsed.data.id, parsed.data.option)
  if (result.error) return { error: result.error }
  revalidatePath('/anasayfa')
  return {}
}

export async function deleteTask(id: unknown): Promise<ActionResult> {
  const parsed = idSchema.safeParse(id)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Geçersiz veri' }
  const result = await TaskService.deleteTask(parsed.data)
  if (result.error) return { error: result.error }
  revalidatePath('/anasayfa')
  return {}
}
