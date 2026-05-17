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

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (targetId === user?.id) {
    throw new Error('Kendi rolünüzü değiştiremezsiniz')
  }

  // Müdür yardımcısı: ogretmen ↔ zumre_baskani arası geçiş
  if (profile.role === 'mudur_yardimcisi') {
    if (!['ogretmen', 'zumre_baskani'].includes(role)) throw new Error('Bu rolü atayamazsınız')

    const { data: target } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', targetId)
      .single()

    if (!target || !['ogretmen', 'zumre_baskani'].includes(target.role)) {
      throw new Error('Yalnızca Öğretmen veya Zümre Başkanının rolünü değiştirebilirsiniz')
    }
  }

  const { error } = await supabase.rpc('assign_user_role', {
    target_id: targetId,
    new_role: role,
  })

  if (error) throw new Error(error.message)
  revalidatePath('/kullanicilar')
}
