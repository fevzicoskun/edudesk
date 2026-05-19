import { SchoolRepository } from '../repositories/SchoolRepository'
import { getCurrentUser } from '@/src/shared/auth'

export const OnboardingService = {
  async setupSchool(name: string): Promise<{ error?: string }> {
    const user = await getCurrentUser()
    if (!user) throw new Error('Giriş gerekli')

    const { data: existing } = await SchoolRepository.findProfileSchool(user.id)
    if (existing?.school_id) return { redirect: '/anasayfa' } as { error?: string }

    const slug = name
      .toLowerCase()
      .replace(/[çÇ]/g, 'c').replace(/[şŞ]/g, 's').replace(/[ğĞ]/g, 'g')
      .replace(/[üÜ]/g, 'u').replace(/[öÖ]/g, 'o').replace(/[ıİ]/g, 'i')
      .replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
      .slice(0, 50) + '-' + Date.now().toString(36)

    const { data: school, error: schoolErr } = await SchoolRepository.insertSchool(name, slug)
    if (schoolErr || !school) return { error: schoolErr?.message ?? 'Okul oluşturulamadı' }

    const { error } = await SchoolRepository.adminOnboardUser({
      p_id:        user.id,
      p_school_id: school.id,
      p_role:      'mudur',
    })

    if (error) return { error: error.message }
    return {}
  },

  async joinSchool(code: string): Promise<{ error?: string }> {
    const user = await getCurrentUser()
    if (!user) throw new Error('Giriş gerekli')

    const { data: existing } = await SchoolRepository.findProfileSchool(user.id)
    if (existing?.school_id) return { redirect: '/anasayfa' } as { error?: string }

    const { data: schools } = await SchoolRepository.findSchoolBySlug(code)
    const school = schools?.[0] ?? null
    if (!school) return { error: 'Bu kod ile bir okul bulunamadı. Başkanınızdan doğru kodu alın.' }

    const { error } = await SchoolRepository.adminOnboardUser({
      p_id:        user.id,
      p_school_id: school.id,
    })

    if (error) return { error: error.message }
    return {}
  },
}
