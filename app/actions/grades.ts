'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod/v4'
import { UUID } from '@/src/shared/validation'
import { GradeService } from '@/src/domains/grades/services/GradeService'

const AddColumnSchema = z.object({
  class_id:   z.string().uuid(),
  title:      z.string().min(1).max(100),
  grade_type: z.enum(['yazili', 'quiz', 'proje']),
  max_score:  z.coerce.number().int().min(1).max(1000),
  exam_date:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional().transform(v => v ?? null),
})

export async function addColumnAction(_: unknown, formData: FormData) {
  const parsed = AddColumnSchema.safeParse({
    class_id:   formData.get('class_id'),
    title:      formData.get('title'),
    grade_type: formData.get('grade_type'),
    max_score:  formData.get('max_score'),
    exam_date:  formData.get('exam_date') || null,
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Geçersiz veri' }

  const result = await GradeService.addColumn(parsed.data)
  if (result.error) return result

  revalidatePath(`/not-defteri/${parsed.data.class_id}`)
  return {}
}

export async function deleteColumnAction(columnId: string, classId: string) {
  UUID.parse(columnId)
  UUID.parse(classId)

  const result = await GradeService.deleteColumn(columnId)
  if (result.error) return result

  revalidatePath(`/not-defteri/${classId}`)
  return {}
}

export async function upsertScoreAction(params: {
  columnId:  string
  classId:   string
  studentId: string
  score:     number | null
}) {
  UUID.parse(params.columnId)
  UUID.parse(params.classId)
  UUID.parse(params.studentId)
  if (params.score !== null && (typeof params.score !== 'number' || params.score < 0)) {
    return { error: 'Geçersiz puan değeri' }
  }

  const result = await GradeService.upsertScore({
    columnId:  params.columnId,
    studentId: params.studentId,
    score:     params.score,
  })
  if (result.error) return result

  revalidatePath(`/not-defteri/${params.classId}`)
  return {}
}
