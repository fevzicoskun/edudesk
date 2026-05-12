export type Role = 'zumre_baskani' | 'ogretmen'
export type SubmissionStatus = 'yapildi' | 'eksik' | 'yapilmadi' | 'gec' | 'mazeretli'
export type CurriculumStatus = 'tamamlandi' | 'tekrar_gerekli' | 'eksik_kaldi'

export interface Profile {
  id: string
  full_name: string
  role: Role
  subject: string | null
  okul_adi: string | null
  created_at: string
}

export interface Class {
  id: string
  name: string
  grade: number
  academic_year: string
  created_at: string
}

export interface Student {
  id: string
  class_id: string
  full_name: string
  student_number: string | null
  created_at: string
}

export interface Homework {
  id: string
  teacher_id: string
  class_id: string
  title: string
  description: string | null
  subject: string
  assigned_date: string
  due_date: string
  created_at: string
}

export interface HomeworkSubmission {
  id: string
  homework_id: string
  student_id: string
  status: SubmissionStatus
  note: string | null
  updated_at: string
}

export interface ZumreMeeting {
  id: string
  title: string
  meeting_date: string
  notes: string | null
  created_by: string
  created_at: string
}

export interface CommonExam {
  id: string
  title: string
  exam_date: string
  subject: string
  grades: number[] | null
  created_by: string
  created_at: string
}

export interface CurriculumProgress {
  id: string
  teacher_id: string
  class_id: string
  outcome_id: string | null
  topic: string
  week_number: number | null
  completed: boolean
  status: CurriculumStatus
  completion_date: string | null
  created_at: string
}
