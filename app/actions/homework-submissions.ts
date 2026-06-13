'use server'

import { revalidatePath } from 'next/cache'
import { UUID } from '@/src/shared/validation'
import { submissionStatusSchema } from '@/src/domains/homework/validators'
import { HomeworkService } from '@/src/domains/homework/services/HomeworkService'
import type { SubmissionStatus } from '@/src/shared/types'
import type { SubmissionLogEntry } from '@/src/domains/homework/repositories/HomeworkRepository'

export async function updateSubmissionStatus(
  homeworkId: string,
  studentId: string,
  status: SubmissionStatus
) {
  if (!UUID.safeParse(homeworkId).success || !UUID.safeParse(studentId).success) return { error: 'Geçersiz istek' }
  if (!submissionStatusSchema.safeParse(status).success) return { error: 'Geçersiz durum değeri' }

  const result = await HomeworkService.updateSubmissionStatus(homeworkId, studentId, status)
  if (!('error' in result)) revalidatePath(`/odevler/${homeworkId}`)
  return result
}

export async function updateAllSubmissionStatuses(
  homeworkId: string,
  studentIds: string[],
  status: SubmissionStatus
) {
  if (!UUID.safeParse(homeworkId).success) return { error: 'Geçersiz istek' }
  if (!submissionStatusSchema.safeParse(status).success) return { error: 'Geçersiz durum değeri' }
  if (studentIds.some(id => !UUID.safeParse(id).success)) return { error: 'Geçersiz öğrenci listesi' }

  const result = await HomeworkService.updateAllSubmissionStatuses(homeworkId, studentIds, status)
  if (!('error' in result)) revalidatePath(`/odevler/${homeworkId}`)
  return result
}

export async function updateSubmissionNote(
  homeworkId: string,
  studentId: string,
  note: string
) {
  if (!UUID.safeParse(homeworkId).success || !UUID.safeParse(studentId).success) return { error: 'Geçersiz istek' }

  const result = await HomeworkService.updateSubmissionNote(homeworkId, studentId, note)
  if (!('error' in result)) revalidatePath(`/odevler/${homeworkId}`)
  return result
}

export async function getStudentHomeworkProfile(studentId: string, classId: string) {
  if (!UUID.safeParse(studentId).success || !UUID.safeParse(classId).success) return { error: 'Geçersiz istek', data: null }
  return HomeworkService.getStudentHomeworkProfile(studentId, classId)
}

export async function getSubmissionLogs(
  homeworkId: string,
  studentId:  string,
): Promise<SubmissionLogEntry[]> {
  if (!UUID.safeParse(homeworkId).success || !UUID.safeParse(studentId).success) return []
  return HomeworkService.getSubmissionLogs(homeworkId, studentId)
}
