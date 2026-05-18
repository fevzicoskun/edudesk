import { z } from 'zod'
export { updateSchoolSchema } from '@/lib/validation'

export const createSchoolSchema = z.object({
  name: z.string().min(2, 'Okul adı en az 2 karakter olmalı').max(120).trim(),
})

export const joinSchoolSchema = z.object({
  code: z.string().min(2, 'Geçersiz okul kodu').max(80).trim(),
})

export const schoolMeetingSchema = z.object({
  title:        z.string().min(2, 'Toplantı adı en az 2 karakter olmalı').max(200),
  meeting_date: z.string().min(1, 'Tarih zorunlu'),
  meeting_type: z.string().default('genel'),
  notes:        z.string().optional().nullable(),
  attendees:    z.string().optional().nullable(),
})
