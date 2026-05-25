import { GradeRepository } from '../repositories/GradeRepository'
import { getAbility } from '@/src/shared/authorization/server'
import { P } from '@/src/shared/permissions'
import type { GradeColumn, GradeEntry, GradeType } from '../types'

export const GradeService = {
  async getColumns(classId: string): Promise<{ data?: GradeColumn[]; error?: string }> {
    const ability = await getAbility()
    if (!ability) return { error: 'Giriş gerekli' }
    if (ability.cannot(P.GRADES.READ)) return { error: 'Bu işlem için yetkiniz yok.' }

    const { data, error } = await GradeRepository.findColumnsByClass(classId, ability.schoolId)
    if (error) return { error: error.message }
    return { data: data ?? [] }
  },

  async getEntries(classId: string): Promise<{ data?: GradeEntry[]; error?: string }> {
    const ability = await getAbility()
    if (!ability) return { error: 'Giriş gerekli' }
    if (ability.cannot(P.GRADES.READ)) return { error: 'Bu işlem için yetkiniz yok.' }

    const { data, error } = await GradeRepository.findEntriesByClass(classId, ability.schoolId)
    if (error) return { error: error.message }
    return { data: data ?? [] }
  },

  async addColumn(data: {
    class_id:   string
    title:      string
    grade_type: GradeType
    max_score:  number
    exam_date:  string | null
  }): Promise<{ data?: GradeColumn; error?: string }> {
    const ability = await getAbility()
    if (!ability) return { error: 'Giriş gerekli' }
    if (ability.cannot(P.GRADES.CREATE)) return { error: 'Bu işlem için yetkiniz yok.' }

    const { data: col, error } = await GradeRepository.insertColumn({
      ...data,
      teacher_id: ability.userId,
      school_id:  ability.schoolId,
    })

    if (error) return { error: error.message }
    return { data: col ?? undefined }
  },

  async deleteColumn(columnId: string): Promise<{ error?: string }> {
    const ability = await getAbility()
    if (!ability) return { error: 'Giriş gerekli' }
    if (ability.cannot(P.GRADES.DELETE)) return { error: 'Bu işlem için yetkiniz yok.' }

    const { data: col } = await GradeRepository.findColumnOwner(columnId, ability.schoolId)
    if (!col) return { error: 'Sütun bulunamadı' }

    const isManager = ability.scope(P.GRADES.DELETE) === 'school'
    if (!isManager && ability.cannot(P.GRADES.DELETE, col.teacher_id)) {
      return { error: 'Bu sütun için yetkiniz yok' }
    }

    const { error } = await GradeRepository.deleteColumn(columnId, col.teacher_id, ability.schoolId)
    if (error) return { error: error.message }
    return {}
  },

  async upsertScore(params: {
    columnId:  string
    studentId: string
    score:     number | null
  }): Promise<{ error?: string }> {
    const ability = await getAbility()
    if (!ability) return { error: 'Giriş gerekli' }
    if (ability.cannot(P.GRADES.UPDATE)) return { error: 'Bu işlem için yetkiniz yok.' }

    const { data: col } = await GradeRepository.findColumnOwner(params.columnId, ability.schoolId)
    if (!col) return { error: 'Sütun bulunamadı' }

    const isManager = ability.scope(P.GRADES.UPDATE) === 'school'
    if (!isManager && ability.cannot(P.GRADES.UPDATE, col.teacher_id)) {
      return { error: 'Bu sütun için yetkiniz yok' }
    }

    const { error } = await GradeRepository.upsertEntry({
      grade_column_id: params.columnId,
      student_id:      params.studentId,
      school_id:       ability.schoolId,
      score:           params.score,
    })

    if (error) return { error: error.message }
    return {}
  },
}
