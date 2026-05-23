export interface Notification {
  id: string
  user_id: string
  school_id: string
  title: string
  body: string | null
  homework_id: string | null
  read_at: string | null
  created_at: string
}

export interface NotificationPreferences {
  user_id: string
  days_before: number
  email_on: boolean
  updated_at: string
}
