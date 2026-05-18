import { z } from 'zod'
export { profileSchema } from '@/lib/validation'

export const AssignableRole = z.enum(['ogretmen', 'zumre_baskani', 'mudur_yardimcisi'])

export const roleAssignmentSchema = z.object({
  targetId: z.string().uuid('Geçersiz kullanıcı ID'),
  newRole: AssignableRole,
})
