'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentProfile } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/service'
import { isMudurOrAbove, type Role } from '@/lib/types'

function randomTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

type InviteResult = { error?: string; success?: boolean; tempPassword?: string }

export async function inviteUser(_: unknown, formData: FormData): Promise<InviteResult> {
  const profile = await getCurrentProfile()
  if (!profile || !isMudurOrAbove(profile.role)) return { error: 'Yetki yok' }
  if (!profile.school_id) return { error: 'Okul bilgisi eksik' }

  const email      = String(formData.get('email') ?? '').trim().toLowerCase()
  const full_name  = String(formData.get('full_name') ?? '').trim()
  const subject    = String(formData.get('subject') ?? '').trim() || null
  const role       = String(formData.get('role') ?? '') as Role

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'Geçerli bir e-posta girin' }
  if (!full_name || full_name.length < 2) return { error: 'Ad soyad en az 2 karakter olmalı' }

  const allowedRoles: Role[] = profile.role === 'mudur_yardimcisi'
    ? ['zumre_baskani', 'ogretmen']
    : ['mudur_yardimcisi', 'zumre_baskani', 'ogretmen']

  if (!allowedRoles.includes(role)) return { error: 'Bu rolü atayamazsınız' }

  const admin = createServiceClient()
  const tempPassword = randomTempPassword()

  const { data: userData, error: createError } = await admin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { full_name },
  })

  if (createError) {
    if (createError.message.includes('already been registered')) return { error: 'Bu e-posta zaten kayıtlı' }
    return { error: createError.message }
  }

  const { error: profileError } = await admin.rpc('admin_set_profile', {
    p_id: userData.user.id,
    p_full_name: full_name,
    p_subject: subject ?? '',
    p_role: role,
    p_school_id: profile.school_id,
  })

  if (profileError) {
    await admin.auth.admin.deleteUser(userData.user.id)
    return { error: 'Profil oluşturulamadı: ' + profileError.message }
  }

  revalidatePath('/kullanicilar')
  return { success: true, tempPassword }
}

type DeleteResult = { error?: string; success?: boolean }

export async function removeUser(targetId: string): Promise<DeleteResult> {
  const profile = await getCurrentProfile()
  if (!profile || !isMudurOrAbove(profile.role)) return { error: 'Yetki yok' }

  const admin = createServiceClient()
  const { data: target } = await admin.from('profiles')
    .select('role, school_id')
    .eq('id', targetId)
    .single()

  if (!target || target.school_id !== profile.school_id) return { error: 'Kullanıcı bulunamadı' }
  if (target.role === 'mudur') return { error: 'Müdür silinemez' }

  if (profile.role === 'mudur_yardimcisi' && !['ogretmen', 'zumre_baskani'].includes(target.role)) {
    return { error: 'Bu kullanıcıyı silemezsiniz' }
  }

  const { error } = await admin.auth.admin.deleteUser(targetId)
  if (error) return { error: error.message }

  revalidatePath('/kullanicilar')
  return { success: true }
}
