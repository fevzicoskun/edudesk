import { AuthRepository } from '../repositories/AuthRepository'
import { SessionRepository } from '@/src/domains/sessions/repositories/SessionRepository'
import type { AuthState } from '../types'

export const AuthService = {
  async signIn(email: string, password: string): Promise<AuthState> {
    const { error } = await AuthRepository.signInWithPassword(email, password)
    if (error) return { error: 'E-posta veya şifre hatalı.' }

    const { data: { user } } = await AuthRepository.getUser()
    if (user) {
      await SessionRepository.createSession(user.id)
    }

    return null
  },

  async signOut(): Promise<void> {
    const { data: { user } } = await AuthRepository.getUser()
    if (user) {
      await SessionRepository.endSession(user.id)
    }
    await AuthRepository.signOut()
  },

  async signUp(data: {
    email: string
    password: string
    full_name: string
    subject: string
    school_code: string
  }): Promise<AuthState> {
    const { data: school } = await AuthRepository.findSchoolByCode(data.school_code)
    if (!school) return { error: 'Geçersiz okul kodu. Müdürünüzden doğrulayın.' }

    const { data: authData, error: signUpError } = await AuthRepository.signUp(
      data.email,
      data.password,
      data.full_name
    )
    if (signUpError) return { error: signUpError.message }
    if (!authData.user) return { error: 'Kayıt başarısız, tekrar deneyin.' }

    const { error: updateError } = await AuthRepository.adminSetProfile({
      p_id: authData.user.id,
      p_full_name: data.full_name,
      p_subject: data.subject ?? '',
      p_role: 'ogretmen',
      p_school_id: school.id,
    })
    if (updateError) return { error: 'Profil oluşturulamadı: ' + updateError.message }

    if (authData.session) {
      await SessionRepository.createSession(authData.user.id)
      return null // signals redirect to /anasayfa
    }

    return { error: '__registered__' } // signals redirect to /login?registered=1
  },

  async updatePassword(password: string): Promise<AuthState> {
    const { data: { user } } = await AuthRepository.getUser()
    if (!user) return { error: 'Giriş gerekli' }

    const { error } = await AuthRepository.updateUser(password)
    if (error) return { error: error.message }

    return null
  },
}
