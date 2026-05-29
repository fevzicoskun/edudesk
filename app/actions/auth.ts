'use server'

import { redirect } from 'next/navigation'
import { loginSchema, changePasswordSchema, registerSchema } from '@/src/domains/auth/validators'
import { AuthService } from '@/src/domains/auth/services/AuthService'
import { createClient } from '@/src/infrastructure/supabase/server'
import type { AuthState } from '@/src/domains/auth/types'

export async function login(prevState: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = loginSchema.safeParse({
    email:    formData.get('email'),
    password: formData.get('password'),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Geçersiz giriş bilgileri.' }
  }

  const result = await AuthService.signIn(parsed.data.email, parsed.data.password)
  if (result) return result

  redirect('/')
}

export async function logout() {
  await AuthService.signOut()
  redirect('/login')
}

export async function register(prevState: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = registerSchema.safeParse({
    full_name:   formData.get('full_name'),
    email:       formData.get('email'),
    password:    formData.get('password'),
    subject:     formData.get('subject'),
    school_code: formData.get('school_code'),
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Geçersiz bilgiler' }

  const result = await AuthService.signUp(parsed.data)
  if (result?.error === '__registered__') {
    redirect('/login?registered=1')
  }
  if (result) return result

  redirect('/anasayfa')
}

export async function sendPasswordReset(
  _prevState: unknown,
  formData: FormData
): Promise<{ error?: string; sent?: boolean }> {
  const email = (formData.get('email') as string)?.trim().toLowerCase()
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: 'Geçerli bir e-posta adresi girin.' }
  }

  const supabase = await createClient()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://myedudesk.com.tr'

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${appUrl}/auth/callback?next=/sifremi-unuttum/yeni-sifre`,
  })

  // Email enumeration'a karşı: hata olsa bile sent:true dön
  if (error) console.error('[password-reset]', error.message)
  return { sent: true }
}

export async function resetPassword(
  _prevState: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string } | null> {
  return changePassword(formData)
}

export async function changePassword(formData: FormData) {
  const parsed = changePasswordSchema.safeParse({
    password: formData.get('password'),
    confirm:  formData.get('confirm'),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Geçersiz şifre bilgileri.' }
  }

  const result = await AuthService.updatePassword(parsed.data.password)
  if (result) return result

  return { error: undefined }
}
