export interface Announcement {
  id: string
  school_id: string
  message: string
  created_by: string
  target_roles: string[]
  created_at: string
}

export interface AnnouncementWithSender extends Announcement {
  sender_name: string
}
