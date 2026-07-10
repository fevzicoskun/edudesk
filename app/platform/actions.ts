'use server'

import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/src/infrastructure/supabase/service'
import { getCurrentUser } from '@/src/shared/auth'
import { z } from 'zod'

async function requirePlatformAdmin() {
  const user = await getCurrentUser()
  if (!user) return null
  const supabase = createServiceClient()
  const { data } = await supabase.from('platform_admins').select('id').eq('id', user.id).maybeSingle()
  return data ? supabase : null
}

const NewSchoolSchema = z.object({
  name:         z.string().min(3).max(100),
  slug:         z.string().regex(/^[A-Z]{3,4}\d{3,4}$/, 'Format: ABC123'),
  status:       z.enum(['active', 'trial', 'suspended']),
  mudur_email:  z.string().email().optional().or(z.literal('')),
  mudur_name:   z.string().min(2).max(80).optional().or(z.literal('')),
  trial_ends:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('')),
}).refine(s => s.status !== 'trial' || !!s.trial_ends, { message: 'Trial için bitiş tarihi zorunlu' })

export async function createSchool(_prev: { error?: string; ok?: boolean } | null, formData: FormData) {
  const supabase = await requirePlatformAdmin()
  if (!supabase) return { error: 'Yetkisiz' }

  const parsed = NewSchoolSchema.safeParse({
    name:        formData.get('name'),
    slug:        formData.get('slug'),
    status:      formData.get('status'),
    mudur_email: formData.get('mudur_email') || undefined,
    mudur_name:  formData.get('mudur_name') || undefined,
    trial_ends:  formData.get('trial_ends') || undefined,
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { name, slug, status, mudur_email, mudur_name } = parsed.data

  // Okul oluştur
  const trialEnd = status === 'trial' && parsed.data.trial_ends ? parsed.data.trial_ends : null
  const { data: school, error: schoolErr } = await supabase
    .from('schools')
    .insert({ name, slug, status, trial_ends_at: trialEnd ? `${trialEnd}T23:59:59+03:00` : null, access_until: trialEnd })
    .select('id')
    .single()

  if (schoolErr) {
    if (schoolErr.code === '23505') return { error: 'Bu slug zaten kullanılıyor' }
    return { error: 'Okul oluşturulamadı' }
  }

  // Müdür daveti
  if (mudur_email) {
    const { data: invited, error: invErr } = await supabase.auth.admin.inviteUserByEmail(mudur_email, {
      data: { full_name: mudur_name || '' },
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://myedudesk.com.tr'}/onboarding`,
    })

    if (!invErr && invited.user) {
      await supabase.from('profiles').upsert({
        id:        invited.user.id,
        school_id: school.id,
        role:      'mudur',
        full_name: mudur_name || '',
      })
    }
  }

  revalidatePath('/platform')
  return { ok: true }
}

export async function updateSchoolStatus(schoolId: string, status: 'active' | 'trial' | 'suspended') {
  const supabase = await requirePlatformAdmin()
  if (!supabase) return
  const patch: { status: string; trial_ends_at?: string | null; access_until?: string } = { status }
  if (status === 'trial') {
    // Panelde tarih sorusu yok — default 30 gün; incelik Ödemeler/SQL ile. ponytail: yeterli.
    const end = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10)
    patch.trial_ends_at = `${end}T23:59:59+03:00`
    patch.access_until = end
  } else {
    // Trial'dan çıkışta bitiş etiketini temizle — /ayarlar'da "Aktif + Trial bitiş" çelişkisi kalmasın.
    // access_until'a DOKUNMA: erişim yalnız ödeme kaydıyla uzar (spec §1).
    patch.trial_ends_at = null
  }
  await supabase.from('schools').update(patch).eq('id', schoolId)
  revalidatePath('/platform')
}

const PaymentSchema = z.object({
  school_id:    z.string().uuid(),
  amount_tl:    z.coerce.number().positive().max(1_000_000),
  paid_at:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  period_end:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note:         z.string().max(300).optional().or(z.literal('')),
}).refine(p => p.period_end >= p.period_start, { message: 'Dönem sonu başlangıçtan önce olamaz' })

export type PaymentRow = {
  id: string
  amount_kurus: number
  paid_at: string
  period_start: string
  period_end: string
  note: string | null
}

export async function recordPayment(
  _prev: { error?: string; ok?: boolean } | null,
  formData: FormData,
): Promise<{ error?: string; ok?: boolean }> {
  const supabase = await requirePlatformAdmin()
  if (!supabase) return { error: 'Yetkisiz' }

  const parsed = PaymentSchema.safeParse({
    school_id:    formData.get('school_id'),
    amount_tl:    formData.get('amount_tl'),
    paid_at:      formData.get('paid_at'),
    period_start: formData.get('period_start'),
    period_end:   formData.get('period_end'),
    note:         formData.get('note'),
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Geçersiz form' }
  const p = parsed.data

  const user = await getCurrentUser()
  const { error: insErr } = await supabase.from('school_payments').insert({
    school_id:    p.school_id,
    amount_kurus: Math.round(p.amount_tl * 100),
    paid_at:      p.paid_at,
    period_start: p.period_start,
    period_end:   p.period_end,
    note:         p.note || null,
    created_by:   user!.id,
  })
  if (insErr) {
    if (insErr.code === '23503') return { error: 'Okul bulunamadı' }
    return { error: `Kayıt başarısız: ${insErr.message}` }
  }

  // access_until = max(mevcut, period_end). Ayrı adım; başarısızlık admin'e görünür (v1 kabul).
  // Not: null (süresiz) okula ödeme girilirse okul bilinçli olarak dönemli takibe geçer.
  const { data: school } = await supabase.from('schools').select('access_until').eq('id', p.school_id).single()
  if (!school || (school.access_until ?? '') < p.period_end) {
    const { error: updErr } = await supabase.from('schools').update({ access_until: p.period_end }).eq('id', p.school_id)
    if (updErr) return { error: `Ödeme kaydedildi ama erişim tarihi güncellenemedi: ${updErr.message}` }
  }

  revalidatePath('/platform')
  return { ok: true }
}

export async function listSchoolPayments(schoolId: string): Promise<{ error?: string; payments?: PaymentRow[] }> {
  const supabase = await requirePlatformAdmin()
  if (!supabase) return { error: 'Yetkisiz' }
  if (typeof schoolId !== 'string') return { error: 'Geçersiz istek' }

  const { data, error } = await supabase
    .from('school_payments')
    .select('id, amount_kurus, paid_at, period_start, period_end, note')
    .eq('school_id', schoolId)
    .order('period_end', { ascending: false })
    .limit(50)
  if (error) return { error: error.message }
  return { payments: data }
}

export async function cancelSchool(schoolId: string) {
  const supabase = await requirePlatformAdmin()
  if (!supabase) return { error: 'Yetkisiz' }

  await supabase
    .from('schools')
    .update({ status: 'cancelled', suspended_at: new Date().toISOString() })
    .eq('id', schoolId)

  revalidatePath('/platform')
  return { ok: true }
}
