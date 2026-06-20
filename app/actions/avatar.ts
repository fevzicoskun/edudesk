'use server'

import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/src/infrastructure/supabase/service'
import { getCurrentUser } from '@/src/shared/auth'
import { logger } from '@/src/infrastructure/observability/logger'

// Kimlik getCurrentUser ile doğrulanır; tüm depolama/DB işlemleri user.id ile kapsanır
// (kullanıcı yalnız kendi {uid}/ klasörüne yazar, yalnız kendi profilini günceller).
// Service client kullanılır: storage RLS'inin auth-context'ine bağımlı değiliz —
// path zaten sunucuda authenticated user.id'den türetiliyor.
export async function uploadAvatar(formData: FormData): Promise<{ error?: string; url?: string }> {
  const user = await getCurrentUser()
  if (!user) return { error: 'Giriş gerekli' }

  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) return { error: 'Dosya bulunamadı' }
  if (file.size > 1_000_000) return { error: 'Görsel çok büyük' } // küçültülmüş webp normalde <100KB

  const supabase = createServiceClient()
  const path = `${user.id}/${Date.now()}.webp`
  const bytes = new Uint8Array(await file.arrayBuffer())
  const { error: upErr } = await supabase.storage
    .from('avatars')
    .upload(path, bytes, { contentType: 'image/webp', upsert: true })
  if (upErr) return { error: upErr.message }

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

  const supabase = createServiceClient()
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
