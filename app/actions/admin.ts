'use server'

import { createServiceClient } from '@/src/infrastructure/supabase/service'
import { getCurrentUser } from '@/src/shared/auth'
import { mailer } from '@/src/lib/mailer'

function randomTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

function makeSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[çÇ]/g, 'c').replace(/[şŞ]/g, 's').replace(/[ğĞ]/g, 'g')
    .replace(/[üÜ]/g, 'u').replace(/[öÖ]/g, 'o').replace(/[ıİ]/g, 'i')
    .replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    .slice(0, 50) + '-' + Date.now().toString(36)
}

export async function provisionSchool(
  _prevState: { error?: string; success?: boolean } | null,
  formData: FormData
): Promise<{ error?: string; success?: boolean }> {
  const user = await getCurrentUser()
  if (!user) return { error: 'Giriş gerekli' }

  const db = createServiceClient()

  const { data: adminRow } = await db
    .from('platform_admins')
    .select('id')
    .eq('id', user.id)
    .maybeSingle()
  if (!adminRow) return { error: 'Yetki yok' }

  const schoolName  = (formData.get('school_name') as string)?.trim()
  const mudurName   = (formData.get('mudur_name') as string)?.trim()
  const mudurEmail  = (formData.get('mudur_email') as string)?.trim().toLowerCase()

  if (!schoolName || schoolName.length < 2) return { error: 'Okul adı en az 2 karakter olmalı' }
  if (!mudurName  || mudurName.length  < 2) return { error: 'Müdür adı soyadı en az 2 karakter olmalı' }
  if (!mudurEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mudurEmail)) return { error: 'Geçerli bir e-posta girin' }

  // 1. Okul oluştur
  const slug = makeSlug(schoolName)
  const { data: school, error: schoolErr } = await db
    .from('schools')
    .insert({ name: schoolName, slug })
    .select('id')
    .single()
  if (schoolErr || !school) return { error: 'Okul oluşturulamadı: ' + (schoolErr?.message ?? '') }

  // 2. Auth kullanıcı oluştur
  const tempPassword = randomTempPassword()
  const { data: authData, error: authErr } = await db.auth.admin.createUser({
    email: mudurEmail,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { full_name: mudurName },
  })
  if (authErr || !authData.user) {
    // Rollback: okulu sil
    await db.from('schools').delete().eq('id', school.id)
    if (authErr?.message.includes('already been registered')) return { error: 'Bu e-posta zaten kayıtlı' }
    return { error: 'Kullanıcı oluşturulamadı: ' + (authErr?.message ?? '') }
  }

  // 3. Profili müdür olarak ayarla
  const { error: profileErr } = await db.rpc('admin_set_profile', {
    p_id:        authData.user.id,
    p_full_name: mudurName,
    p_subject:   '',
    p_role:      'mudur',
    p_school_id: school.id,
  })
  if (profileErr) {
    await db.auth.admin.deleteUser(authData.user.id)
    await db.from('schools').delete().eq('id', school.id)
    return { error: 'Profil oluşturulamadı: ' + profileErr.message }
  }

  // 4. Davet e-postası gönder
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://myedudesk.com.tr'
  try {
    await mailer.sendMail({

      to: mudurEmail,
      subject: 'EduDesk — Okul Hesabınız Hazır',
      html: `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#1a1a1a">
        <h2 style="margin-bottom:4px">Hoş Geldiniz, ${mudurName}</h2>
        <p style="color:#555;margin-top:0"><strong>${schoolName}</strong> için EduDesk hesabınız oluşturuldu.</p>
        <div style="background:#f4f6ff;border-radius:10px;padding:20px 24px;margin:24px 0">
          <p style="margin:0 0 8px 0;font-size:13px;color:#666">Giriş bilgileriniz:</p>
          <p style="margin:4px 0"><strong>E-posta:</strong> ${mudurEmail}</p>
          <p style="margin:4px 0"><strong>Geçici Şifre:</strong> <code style="background:#e8ecff;padding:2px 8px;border-radius:4px;font-size:15px">${tempPassword}</code></p>
        </div>
        <a href="${appUrl}/login" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:15px">Giriş Yap →</a>
        <p style="margin-top:24px;font-size:13px;color:#888">Giriş yaptıktan sonra Profil sayfasından şifrenizi değiştirebilirsiniz.</p>
        <p style="margin-top:32px;font-size:12px;color:#bbb">EduDesk — Okul Takip Sistemi</p>
      </body></html>`,
    })
  } catch {
    // E-posta hatası kritik değil — okul ve müdür oluşturuldu, sadece uyar
    return { success: true, error: 'Okul oluşturuldu fakat davet e-postası gönderilemedi. Şifreyi manuel paylaşın: ' + tempPassword }
  }

  return { success: true }
}

export async function deleteSchool(
  schoolId: string
): Promise<{ error?: string }> {
  const user = await getCurrentUser()
  if (!user) return { error: 'Giriş gerekli' }

  const db = createServiceClient()

  const { data: adminRow } = await db
    .from('platform_admins')
    .select('id')
    .eq('id', user.id)
    .maybeSingle()
  if (!adminRow) return { error: 'Yetki yok' }

  // Auth user ID'lerini sil öncesi topla (profiles RPC'de silinecek)
  const { data: profiles } = await db
    .from('profiles')
    .select('id')
    .eq('school_id', schoolId)

  // Tüm okul verisini tek transaction'da sil
  const { error: delErr } = await db.rpc('delete_school', { p_school_id: schoolId })
  if (delErr) return { error: 'Silme hatası: ' + delErr.message }

  // Auth kullanıcılarını sil
  for (const p of profiles ?? []) {
    await db.auth.admin.deleteUser(p.id)
  }

  return {}
}
