export type MeetingResult = { error?: string; success?: boolean; id?: string }

export interface SchoolMeeting {
  id: string
  school_id: string
  created_by: string
  title: string
  meeting_date: string
  meeting_type: string
  notes: string | null
  attendees: string | null
  created_at: string
}
