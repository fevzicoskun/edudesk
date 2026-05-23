'use server'

import { z } from 'zod'
import { getCurrentUser, getCurrentProfile } from '@/src/shared/auth'
import { createServiceClient } from '@/src/infrastructure/supabase/service'

const schema = z.object({
  message: z.string().min(5, 'En az 5 karakter giriniz'),
})

export async function sendZumreNotification(_: unknown, formData: FormData) {
  const user = await getCurrentUser()
  const profile = await getCurrentProfile()

  if (!user || !profile) return { error: 'Giriş gerekli' }
  if (profile.role !== 'zumre_baskani') return { error: 'Bu işlem için yetkiniz yok' }
  if (!profile.subject) return { error: 'Profilinizde branş bilgisi eksik' }
  if (!profile.school_id) return { error: 'Okul bilgisi bulunamadı' }

  const parsed = schema.safeParse({ message: formData.get('message') })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Geçersiz veri' }

  const supabase = createServiceClient()

  // Aynı branştaki öğretmenleri bul (kendisi hariç)
  const { data: teachers, error: teacherErr } = await supabase
    .from('profiles')
    .select('id')
    .eq('school_id', profile.school_id)
    .eq('subject', profile.subject)
    .eq('role', 'ogretmen')
    .neq('id', user.id)

  if (teacherErr) return { error: 'Öğretmenler alınamadı' }
  if (!teachers || teachers.length === 0) return { error: 'Bu branşta bildirim gönderilecek öğretmen bulunamadı' }

  const now = new Date().toISOString()
  const notifications = teachers.map(t => ({
    user_id:    t.id,
    school_id:  profile.school_id,
    title:      'Zümre Duyurusu',
    body:       `${profile.full_name}: ${parsed.data.message}`,
    homework_id: null as null,
    created_at:  now,
  }))

  const { error: insertErr } = await supabase.from('notifications').insert(notifications)
  if (insertErr) return { error: 'Bildirim gönderilemedi' }

  return { success: true, count: teachers.length }
}
