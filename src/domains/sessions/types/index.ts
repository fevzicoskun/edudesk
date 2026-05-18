export interface Session {
  id: string
  user_id: string
  school_id: string | null
  login_at: string
  last_seen_at: string
  logout_at: string | null
  duration_minutes: number | null
}
