import { SchoolRepository } from '../repositories/SchoolRepository'
import { getCurrentProfile, requireSchoolId } from '@/src/shared/auth'

function randomCode(): string {
  const chars = 'ABCDEFGHJKLMNPRSTUVWXYZ'
  const letters = Array.from({ length: 3 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  const digits  = Array.from({ length: 3 }, () => Math.floor(Math.random() * 10)).join('')
  return letters + digits
}

export const SchoolService = {
  async setupSchool(name: string): Promise<{ error?: string; redirect?: string }> {
    const profile = await getCurrentProfile()
    if (!profile || profile.role !== 'mudur') return { error: 'Yetki yok' }
    if (!profile.school_id) return { error: 'Okul kaydı bulunamadı' }

    if (name.length < 2) return { error: 'Okul adı en az 2 karakter olmalı' }
    if (name.length > 200) return { error: 'Okul adı çok uzun' }

    const code = randomCode()
    const { error } = await SchoolRepository.updateSchool(profile.school_id, { name, slug: code })
    if (error) return { error: error.message }

    return { redirect: '/anasayfa' }
  },

  async updateSchoolSettings(name: string): Promise<{ error?: string; success?: boolean }> {
    const profile = await getCurrentProfile()
    if (!profile || profile.role !== 'mudur') return { error: 'Yetki yok' }

    const school_id = await requireSchoolId()
    const { error } = await SchoolRepository.updateSchool(school_id, { name })
    if (error) return { error: error.message }

    return { success: true }
  },

  async regenerateSchoolCode(): Promise<{ error?: string; code?: string }> {
    const profile = await getCurrentProfile()
    if (!profile || profile.role !== 'mudur') return { error: 'Yetki yok' }

    const school_id = await requireSchoolId()
    const code = randomCode()
    const { error } = await SchoolRepository.updateSchool(school_id, { slug: code })
    if (error) return { error: error.message }

    return { code }
  },
}
