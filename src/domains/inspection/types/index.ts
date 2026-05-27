// src/domains/inspection/types/index.ts

export interface DailyPlan {
  id:               string
  teacher_id:       string
  school_id:        string
  class_id:         string
  plan_date:        string
  lesson_hour:      number
  unit:             string
  topic:            string
  objectives:       string[]
  methods:          string[]
  materials:        string[]
  intro_text:       string
  development_text: string
  conclusion_text:  string
  created_at:       string
  deleted_at:       string | null
}

export interface AnnualPlan {
  id:            string
  teacher_id:    string
  school_id:     string
  academic_year: string
  subject:       string
  weekly_plan:   WeeklyEntry[]
  approved_at:   string | null
  created_at:    string
}

export interface WeeklyEntry {
  week:       number
  dates:      string
  topics:     string[]
  objectives: string[]
}

export interface SokReport {
  id:            string
  teacher_id:    string
  school_id:     string
  class_id:      string
  meeting_date:  string
  term:          1 | 2
  academic_year: string
  participants:  Participant[]
  agenda_items:  AgendaItem[]
  decisions:     Decision[]
  student_notes: StudentNote[]
  created_at:    string
  deleted_at:    string | null
}

export interface Participant {
  user_id:   string
  full_name: string
  subject:   string
}

export interface AgendaItem {
  order:     number
  text:      string
  discussed: boolean
  note:      string
}

export interface Decision {
  order: number
  text:  string
  note:  string
}

export interface StudentNote {
  student_id:   string
  student_name: string
  status:       'basarili' | 'basarisiz' | 'riskli'
  note:         string
}

export interface NotebookCheck {
  id:         string
  teacher_id: string
  school_id:  string
  class_id:   string
  check_date: string
  notes:      string | null
  created_at: string
}

// ── Standart metin sabitleri ──────────────────────────────────────────────────

export const DEFAULT_INTRO_TEXT =
  'Bir önceki dersin konusu kısaca hatırlatılır, günlük konuya motivasyon sorusu yöneltilir.'

export const DEFAULT_DEVELOPMENT_TEXT =
  'Konu öğretmen tarafından anlatılır, örnek problemler çözülür, öğrencilerden aktif katılım beklenir.'

export const DEFAULT_CONCLUSION_TEXT =
  'Öğrencilere sınıf içi değerlendirme soruları yöneltilir. Ev ödevi verilir.'

export const DEFAULT_AGENDA_ITEMS: Omit<AgendaItem, 'discussed' | 'note'>[] = [
  { order: 1, text: 'Sınıfın genel akademik durumunun değerlendirilmesi' },
  { order: 2, text: 'Öğrencilerin devamsızlık durumlarının görüşülmesi' },
  { order: 3, text: 'Öğrencilerin davranış ve disiplin durumlarının değerlendirilmesi' },
  { order: 4, text: 'Başarısız ve başarılı öğrencilerin belirlenmesi, gerekli tedbirlerin alınması' },
  { order: 5, text: 'Öğrencilerin rehberlik ihtiyaçlarının belirlenmesi' },
  { order: 6, text: 'Ders dışı etkinliklere ve sosyal faaliyetlere katılımın değerlendirilmesi' },
  { order: 7, text: 'Sınıfın temizlik, düzen ve fiziki ortamının değerlendirilmesi' },
  { order: 8, text: 'Velilerle işbirliği ve iletişimin değerlendirilmesi' },
  { order: 9, text: 'Dilek ve temenniler' },
]

export const DEFAULT_DECISIONS: Omit<Decision, 'note'>[] = [
  { order: 1, text: 'Başarısız öğrencilerin velileri okula davet edilecektir.' },
  { order: 2, text: 'Devamsızlığı yüksek öğrenciler için veli bildirimi yapılacaktır.' },
  { order: 3, text: 'Rehberlik servisine yönlendirilmesi gereken öğrenciler bildirilecektir.' },
]

export const LESSON_METHODS = [
  'Anlatım', 'Soru-Cevap', 'Grup Çalışması', 'Problem Çözme', 'Beyin Fırtınası',
] as const

export const LESSON_MATERIALS = [
  'Akıllı Tahta', 'Ders Kitabı', 'Projeksiyon', 'Cetvel', 'Pergel',
] as const

export interface CompletionStatus {
  dailyPlans:     boolean
  annualPlan:     boolean
  zumreMeetings:  boolean
  commonExams:    boolean
  sokReports:     boolean
  notebookChecks: boolean
  score:          number  // 0–100, 6 belgeden kaç tanesi mevcut
}
