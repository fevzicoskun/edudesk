import { SchoolRepository } from '../repositories/SchoolRepository'
import { getAbility } from '@/src/shared/authorization/server'
import { P } from '@/src/shared/permissions'
import { generateSchoolCode } from '@/src/shared/utils'

export const SchoolService = {
  async setupSchool(name: string): Promise<{ error?: string; redirect?: string }> {
    const ability = await getAbility()
    if (!ability || ability.cannot(P.SCHOOL.UPDATE)) return { error: 'Yetki yok' }
    if (!ability.schoolId) return { error: 'Okul kaydı bulunamadı' }

    if (name.length < 2) return { error: 'Okul adı en az 2 karakter olmalı' }
    if (name.length > 200) return { error: 'Okul adı çok uzun' }

    const code = generateSchoolCode()
    const { error } = await SchoolRepository.updateSchool(ability.schoolId, { name, slug: code })
    if (error) return { error: error.message }

    return { redirect: '/anasayfa' }
  },

  async updateSchoolSettings(name: string): Promise<{ error?: string }> {
    const ability = await getAbility()
    if (!ability || ability.cannot(P.SCHOOL.UPDATE)) return { error: 'Yetki yok' }

    const { error } = await SchoolRepository.updateSchool(ability.schoolId, { name })
    if (error) return { error: error.message }

    return {}
  },

  async regenerateSchoolCode(): Promise<{ error?: string; code?: string }> {
    const ability = await getAbility()
    if (!ability || ability.cannot(P.SCHOOL.UPDATE)) return { error: 'Yetki yok' }

    const code = generateSchoolCode()
    const { error } = await SchoolRepository.updateSchool(ability.schoolId, { slug: code })
    if (error) return { error: error.message }

    return { code }
  },
}
