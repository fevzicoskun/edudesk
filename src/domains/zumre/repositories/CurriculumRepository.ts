import { createClient } from '@/src/infrastructure/supabase/server'
import type { CurriculumStatus } from '../types'

export const CurriculumRepository = {
  async insertProgress(data: {
    teacher_id: string
    class_id: string
    topic: string
    week_number: number | null
    status: CurriculumStatus
    completed: boolean
    completion_date: string | null
    school_id: string
  }) {
    const supabase = await createClient()
    return supabase.from('curriculum_progress').insert(data)
  },

  async insertProgressBulk(rows: {
    teacher_id: string
    class_id: string
    topic: string
    week_number: number
    status: CurriculumStatus
    completed: boolean
    completion_date: string | null
    school_id: string
  }[]) {
    const supabase = await createClient()
    return supabase.from('curriculum_progress').insert(rows)
  },

  async updateProgressStatus(id: string, teacherId: string, data: {
    status: CurriculumStatus
    completed: boolean
    completion_date: string | null
  }) {
    const supabase = await createClient()
    return supabase
      .from('curriculum_progress')
      .update(data)
      .eq('id', id)
      .eq('teacher_id', teacherId)
  },

  async deleteProgress(id: string, teacherId: string) {
    const supabase = await createClient()
    return supabase.from('curriculum_progress').delete().eq('id', id).eq('teacher_id', teacherId)
  },

  async clearClassCurriculum(classId: string, teacherId: string) {
    const supabase = await createClient()
    return supabase
      .from('curriculum_progress')
      .delete()
      .eq('class_id', classId)
      .eq('teacher_id', teacherId)
  },

  async findExistingTopics(teacherId: string, classId: string) {
    const supabase = await createClient()
    return supabase
      .from('curriculum_progress')
      .select('topic')
      .eq('teacher_id', teacherId)
      .eq('class_id', classId)
  },

  async findClassGrade(classId: string, schoolId: string) {
    const supabase = await createClient()
    return supabase.from('classes').select('grade').eq('id', classId).eq('school_id', schoolId).single()
  },

  async findStudentsByClass(classId: string) {
    const supabase = await createClient()
    return supabase
      .from('students')
      .select('id, full_name')
      .eq('class_id', classId)
      .order('full_name')
  },
}
