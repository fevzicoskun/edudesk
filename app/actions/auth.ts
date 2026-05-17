'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { loginSchema, changePasswordSchema, registerSchema } from '@/lib/validation'
import { startSession, endSession } from './session'

type AuthState = { error: string } | null

export async function login(prevState: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Geçersiz giriş bilgileri.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword(parsed.data)

  if (error) {
    return { error: 'E-posta veya şifre hatalı.' }
  }

  await startSession()
  redirect('/')
}

export async function logout() {
  await endSession()
  const supabase = await createClient()
  await supabase.auth.signOut()
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

  const supabase = await createClient()
  const admin = createServiceClient()

  // Okul kodunu doğrula (RLS bypass — kayıt sırasında oturum yok)
  const { data: school } = await admin
    .from('schools')
    .select('id')
    .ilike('slug', parsed.data.school_code.trim())
    .single()
  if (!school) return { error: 'Geçersiz okul kodu. Müdürünüzden doğrulayın.' }

  // Kullanıcı oluştur
  const { data: authData, error: signUpError } = await supabase.auth.signUp({
    email:    parsed.data.email,
    password: parsed.data.password,
    options:  { data: { full_name: parsed.data.full_name } },
  })
  if (signUpError) return { error: signUpError.message }
  if (!authData.user) return { error: 'Kayıt başarısız, tekrar deneyin.' }

  // Profili güncelle (service role — trigger yeni kaydı oluşturduktan sonra)
  const { error: updateError } = await admin.from('profiles').update({
    full_name: parsed.data.full_name,
    subject:   parsed.data.subject,
    school_id: school.id,
  }).eq('id', authData.user.id)
  if (updateError) return { error: 'Profil güncellenemedi: ' + updateError.message }

  // Oturum hemen açıldıysa giriş yap, yoksa doğrulama bekliyor
  if (authData.session) {
    await startSession()
    redirect('/anasayfa')
  }

  redirect('/login?registered=1')
}

export async function changePassword(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Giriş gerekli' }

  const parsed = changePasswordSchema.safeParse({
    password: formData.get('password'),
    confirm: formData.get('confirm'),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Geçersiz şifre bilgileri.' }
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password })
  if (error) return { error: error.message }

  return { error: undefined }
}
