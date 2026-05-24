import { z } from 'zod'
export { updateSchoolSchema } from '@/src/shared/validation'

export const createSchoolSchema = z.object({
  name: z.string().min(2, 'Okul adı en az 2 karakter olmalı').max(120).trim(),
})

// Eski format: 3 harf + 3 rakam (örn: ABK729)
// Yeni format: 4 harf + 4 rakam (örn: ABCD1234)
const SCHOOL_CODE_RE = /^[A-Za-z]{3,4}\d{3,4}$/

export const joinSchoolSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(SCHOOL_CODE_RE, 'Okul kodu 3-4 harf + 3-4 rakamdan oluşmalıdır (örn: ABCD1234)'),
})

export const schoolMeetingSchema = z.object({
  title:        z.string().min(2, 'Toplantı adı en az 2 karakter olmalı').max(200),
  meeting_date: z.string().min(1, 'Tarih zorunlu'),
  meeting_type: z.string().default('genel'),
  notes:        z.string().optional().nullable(),
  attendees:    z.string().optional().nullable(),
})
