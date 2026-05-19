'use server'

import { revalidatePath } from 'next/cache'
import { ScheduleService } from '@/src/domains/mentor/services/ScheduleService'

export async function createScheduleWithFile(input: {
  schedule_type: 'resmi' | 'okul'
  type_label: string
  teacher_id?: string | null
  class_id?: string | null
  file_url: string
  file_name: string
}) {
  await ScheduleService.createScheduleWithFile(input)
  revalidatePath('/ders-programi')
  revalidatePath('/anasayfa')
}

export async function updateScheduleFile(id: string, file_url: string, file_name: string) {
  await ScheduleService.updateScheduleFile(id, file_url, file_name)
  revalidatePath('/ders-programi')
  revalidatePath('/anasayfa')
}

export async function renameOkulTypeLabel(newLabel: string) {
  await ScheduleService.renameOkulTypeLabel(newLabel)
  revalidatePath('/ders-programi')
}

export async function deleteSchedule(id: string) {
  await ScheduleService.deleteSchedule(id)
  revalidatePath('/ders-programi')
  revalidatePath('/anasayfa')
}
