import { z } from 'zod'
import { isMeaningfulText } from './text'

export const UUID = z.string().uuid('Geçersiz ID')

export const loginSchema = z.object({
  email: z.string().email('Geçerli bir e-posta girin'),
  password: z.string().min(6, 'Şifre en az 6 karakter olmalı'),
})

export const changePasswordSchema = z.object({
  password: z.string().min(6, 'Şifre en az 6 karakter olmalı'),
  confirm: z.string(),
}).refine(d => d.password === d.confirm, {
  message: 'Şifreler eşleşmiyor',
  path: ['confirm'],
})

export const createClassSchema = z.object({
  name: z.string().min(1, 'Sınıf adı gerekli').max(100),
  grade: z.coerce.number().int().min(1).max(12),
})

export const addStudentSchema = z.object({
  full_name: z.string().min(2, 'Ad en az 2 karakter olmalı').max(120),
  student_number: z.string().max(20).optional().nullable(),
})

export const studentNoteSchema = z.object({
  body: z.string().min(1, 'Not boş olamaz').max(1000),
})

export const createHomeworkSchema = z.object({
  class_id:    UUID,
  title:       z.string().min(2, 'Başlık en az 2 karakter olmalı').max(200)
                 .refine(isMeaningfulText, 'Geçerli bir başlık girin'),
  description: z.string().max(2000).optional().nullable(),
  subject:     z.string().min(1, 'Ders gerekli').max(100),
  due_date:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Geçersiz tarih formatı').optional().nullable(),
  source_id:   UUID.optional().nullable(),
  is_template: z.preprocess(v => v === 'true' || v === true, z.boolean()).default(false),
})

export const createHomeworkSourceSchema = z.object({
  name:    z.string().min(1, 'Kaynak adı gerekli').max(100),
  subject: z.string().max(100).optional().nullable(),
})

export const updateHomeworkSourceSchema = z.object({
  id:      UUID,
  name:    z.string().min(1).max(100).optional(),
  active:  z.boolean().optional(),
})

export const createMeetingSchema = z.object({
  title: z.string().min(1, 'Başlık gerekli').max(200),
  meeting_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Geçersiz tarih formatı'),
  notes: z.string().max(5000).optional().nullable(),
  branch: z.string().max(100).optional().nullable(),
})

export const submissionStatusSchema = z.enum(['yapildi', 'eksik', 'yapilmadi', 'gec', 'mazeretli'])

export const attendanceStatusSchema = z.enum(['present', 'absent', 'late', 'excused'])

export const profileSchema = z.object({
  full_name: z.string().min(2, 'Ad en az 2 karakter olmalı').max(120),
  subject: z.string().max(100).optional().nullable(),
})

export const registerSchema = z.object({
  full_name:   z.string().min(2, 'Ad en az 2 karakter olmalı').max(120),
  email:       z.string().email('Geçerli bir e-posta girin'),
  password:    z.string().min(6, 'Şifre en az 6 karakter olmalı'),
  subject:     z.string().min(1, 'Branş gerekli').max(100),
  school_code: z.string().min(1, 'Okul kodu gerekli').max(50),
})

export const updateSchoolSchema = z.object({
  name: z.string().min(2, 'Okul adı gerekli').max(200),
})

export const veliContactSchema = z.object({
  veli_email:   z.string().email('Geçersiz e-posta adresi').optional().or(z.literal('')),
  veli_telefon: z.string().max(20).optional().or(z.literal('')),
  veli_ad:      z.string().max(120).optional().or(z.literal('')),
})

// Geri bildirim formu — kategori seti components/FeedbackButton.tsx ile birebir
export const feedbackSchema = z.object({
  category:  z.enum(['oneri', 'istek', 'sikayet']),
  message:   z.string().trim().min(3).max(2000),
  page_path: z.string().max(200).optional().default(''),
})

export function parseFormData<T>(schema: z.ZodSchema<T>, formData: FormData): T {
  const raw = Object.fromEntries(formData.entries())
  return schema.parse(raw)
}

export function safeParseFormData<T>(schema: z.ZodSchema<T>, formData: FormData) {
  const raw = Object.fromEntries(formData.entries())
  return schema.safeParse(raw)
}
