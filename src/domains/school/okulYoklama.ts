import { cache } from 'react'
import { SchoolService } from './services/SchoolService'

/** Sunucu bileşenleri için: okulun yoklama modülü açık mı (istek başına tek sorgu). */
export const okulYoklamaAktif = cache((schoolId: string) => SchoolService.yoklamaAktif(schoolId))
