import { z } from 'zod'

const metin = z.string().trim().max(2000, 'En fazla 2000 karakter').optional()

/** Tanıma kartı — tüm alanlar isteğe bağlı, görüşme ilerledikçe doldurulur */
export const mentorProfileSchema = z.object({
  goals_short:       metin,
  goals_long:        metin,
  interests:         metin,
  family_info:       metin,
  study_environment: metin,
  special_note:      metin,
  support_request:   metin,
})

export type MentorProfileInput = z.infer<typeof mentorProfileSchema>
