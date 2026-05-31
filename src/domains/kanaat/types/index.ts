export interface KanaatInput {
  homeworkTotal:  number        // Dönem içi toplam ödev sayısı
  homeworkDone:   number        // Teslim edilen ödev sayısı
  absenceDays:    number        // Devamsızlık gün sayısı
  examAverage:    number | null // 0-100 arası; null = sınav girilmemiş
}

export interface KanaatResult {
  score: 1 | 2 | 3 | 4 | 5
  text:  string
}

export interface KanaatNotu {
  id:         string
  student_id: string
  class_id:   string
  teacher_id: string
  school_id:  string
  score:      1 | 2 | 3 | 4 | 5
  text:       string
  donem:      string
  created_at: string
  updated_at: string
}

export interface KanaatHesap {
  studentId:   string
  studentName: string
  score:       1 | 2 | 3 | 4 | 5
  text:        string
}
