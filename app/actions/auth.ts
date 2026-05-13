'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

type AuthState = { error: string } | null

export async function login(prevState: AuthState, formData: FormData): Promise<AuthState> {
  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  })

  if (error) {
    return { error: 'E-posta veya şifre hatalı.' }
  }

  redirect('/')
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

export async function changePassword(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Giriş gerekli' }

  const password = formData.get('password') as string
  const confirm = formData.get('confirm') as string

  if (!password || password.length < 6) return { error: 'Şifre en az 6 karakter olmalı' }
  if (password !== confirm) return { error: 'Şifreler eşleşmiyor' }

  const { error } = await supabase.auth.updateUser({ password })
  if (error) return { error: error.message }

  return { error: undefined }
}
