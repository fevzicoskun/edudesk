import { z } from 'zod'

export const tokenTypeSchema = z.enum(['veli', 'yoklama', 'tutanak'])

export const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Geçersiz tarih formatı (YYYY-MM-DD bekleniyor)')
