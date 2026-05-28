'use server'

import { revalidatePath } from 'next/cache'
import { UUID, createHomeworkSourceSchema } from '@/src/shared/validation'
import { HomeworkSourceService } from '@/src/domains/homework/services/HomeworkSourceService'

export async function getHomeworkSources() {
  return HomeworkSourceService.getSources()
}

export async function createHomeworkSource(_: unknown, formData: FormData) {
  const parsed = createHomeworkSourceSchema.safeParse({
    name:    formData.get('name'),
    subject: formData.get('subject') || null,
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Geçersiz veri', data: null }

  const result = await HomeworkSourceService.createSource(parsed.data.name, parsed.data.subject ?? null)
  if (result.error) return result

  revalidatePath('/ayarlar')
  revalidatePath('/odevler/yeni')
  return { data: result.data, error: null }
}

export async function deleteHomeworkSource(id: string) {
  UUID.parse(id)
  const result = await HomeworkSourceService.deleteSource(id)
  if (result.error) throw new Error(result.error)
  revalidatePath('/ayarlar')
  revalidatePath('/odevler/yeni')
}
