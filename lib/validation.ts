import { z } from 'zod'

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
  class_id: UUID,
  title: z.string().min(1, 'Başlık gerekli').max(200),
  description: z.string().max(2000).optional().nullable(),
  subject: z.string().min(1, 'Ders gerekli').max(100),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Geçersiz tarih formatı'),
})

export const createMeetingSchema = z.object({
  title: z.string().min(1, 'Başlık gerekli').max(200),
  meeting_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Geçersiz tarih formatı'),
  notes: z.string().max(5000).optional().nullable(),
})

export const createExamSchema = z.object({
  title: z.string().min(1, 'Başlık gerekli').max(200),
  subject: z.string().min(1, 'Ders gerekli').max(100),
  exam_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Geçersiz tarih formatı'),
})

export const submissionStatusSchema = z.enum(['yapildi', 'eksik', 'yapilmadi', 'gec', 'mazeretli'])

export const curriculumStatusSchema = z.enum(['tamamlandi', 'tekrar_gerekli', 'eksik_kaldi'])

export const createCurriculumProgressSchema = z.object({
  class_id: UUID,
  topic: z.string().min(1, 'Konu gerekli').max(500),
  week_number: z.coerce.number().int().min(1).max(52).optional().nullable(),
  status: curriculumStatusSchema.default('tamamlandi'),
})

export const attendanceStatusSchema = z.enum(['present', 'absent', 'late', 'excused'])

export const saveAttendanceSchema = z.object({
  classId: UUID,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Geçersiz tarih formatı'),
  records: z.array(z.object({
    studentId: UUID,
    status: attendanceStatusSchema,
  })).max(100),
})

export const profileSchema = z.object({
  full_name: z.string().min(2, 'Ad en az 2 karakter olmalı').max(120),
  subject: z.string().max(100).optional().nullable(),
  okul_adi: z.string().max(200).optional().nullable(),
})

export function parseFormData<T>(schema: z.ZodSchema<T>, formData: FormData): T {
  const raw = Object.fromEntries(formData.entries())
  return schema.parse(raw)
}

export function safeParseFormData<T>(schema: z.ZodSchema<T>, formData: FormData) {
  const raw = Object.fromEntries(formData.entries())
  return schema.safeParse(raw)
}
