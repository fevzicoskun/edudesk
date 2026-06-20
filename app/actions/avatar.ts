'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/src/infrastructure/supabase/server'
import { getCurrentUser } from '@/src/shared/auth'
import { logger } from '@/src/infrastructure/observability/logger'

// Client dosyayı kendi {userId}/ klasörüne yükler, sonra yolu buraya gönderir.
// Sunucu yolun kullanıcıya ait olduğunu doğrular ve public URL'i profile yazar.
export async function updateAvatar(path: string): Promise<{ error?: string; url?: string }> {
  const user = await getCurrentUser()
  if (!user) return { error: 'Giriş gerekli' }
  if (!path.startsWith(`${user.id}/`) || path.includes('..')) return { error: 'Geçersiz dosya yolu' }

  const supabase = await createClient()
  const url = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl
  const { error } = await supabase.from('profiles').update({ avatar_url: url }).eq('id', user.id)
  if (error) return { error: error.message }

  revalidatePath('/profil')
  revalidatePath('/anasayfa')
  return { url }
}

export async function removeAvatar(): Promise<{ error?: string }> {
  const user = await getCurrentUser()
  if (!user) return { error: 'Giriş gerekli' }

  const supabase = await createClient()
  const { data: prof } = await supabase.from('profiles').select('avatar_url').eq('id', user.id).single()
  const current = prof?.avatar_url as string | null | undefined

  // Storage'dan dosyayı sil (best-effort; başarısız olsa da url=null yapılır, öksüz dosya tolere edilir).
  if (current) {
    const path = current.split('/avatars/')[1]?.split('?')[0]
    if (path) {
      const { error: rmErr } = await supabase.storage.from('avatars').remove([decodeURIComponent(path)])
      if (rmErr) logger.error({ event: 'avatar_remove_failed', userId: user.id, err: rmErr.message }, 'Avatar dosyası silinemedi')
    }
  }

  const { error } = await supabase.from('profiles').update({ avatar_url: null }).eq('id', user.id)
  if (error) return { error: error.message }

  revalidatePath('/profil')
  revalidatePath('/anasayfa')
  return {}
}
