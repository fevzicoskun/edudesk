import { z } from 'zod'

export const MUDUR_TARGET_ROLES = ['ogretmen', 'zumre_baskani', 'mudur_yardimcisi'] as const
export const MY_TARGET_ROLES = ['ogretmen', 'zumre_baskani'] as const

export const createAnnouncementSchema = z.object({
  message: z.string().min(10, 'Duyuru en az 10 karakter olmalıdır'),
  target_roles: z
    .array(z.string())
    .min(1, 'En az bir hedef grup seçmelisiniz'),
})
