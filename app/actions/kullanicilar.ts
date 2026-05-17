'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile } from '@/lib/auth'
import { isMudurOrAbove } from '@/lib/types'
import { UUID } from '@/lib/validation'
import { z } from 'zod'

const AssignableRole = z.enum(['ogretmen', 'zumre_baskani', 'mudur_yardimcisi'])

export async function assignRole(targetId: string, newRole: string) {
  UUID.parse(targetId)
  const role = AssignableRole.parse(newRole)

  const profile = await getCurrentProfile()
  if (!profile || !isMudurOrAbove(profile.role)) {
    throw new Error('Yetki yok')
  }

  // mudur_yardimcisi sadece ogretmen ve zumre_baskani atayabilir
  if (profile.role === 'mudur_yardimcisi' && role === 'mudur_yardimcisi') {
    throw new Error('Bu rolü atayamazsınız')
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('assign_user_role', {
    target_id: targetId,
    new_role: role,
  })

  if (error) throw new Error(error.message)
  revalidatePath('/kullanicilar')
}
