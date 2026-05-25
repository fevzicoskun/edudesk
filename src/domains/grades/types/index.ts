export type GradeType = 'yazili' | 'quiz' | 'proje'

export interface GradeColumn {
  id:         string
  teacher_id: string
  class_id:   string
  school_id:  string
  title:      string
  grade_type: GradeType
  max_score:  number
  exam_date:  string | null
  created_at: string
}

export interface GradeEntry {
  id:               string
  grade_column_id:  string
  student_id:       string
  school_id:        string
  score:            number | null
  updated_at:       string
}

/** student_id → score (null = henüz girilmedi) */
export type ScoreMap = Record<string, number | null>
