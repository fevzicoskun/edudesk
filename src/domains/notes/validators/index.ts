import { z } from 'zod'

export const noteContentSchema = z.object({
  title:   z.string().max(200, 'Başlık en fazla 200 karakter olabilir'),
  content: z.string().max(50000, 'İçerik en fazla 50.000 karakter olabilir'),
})
