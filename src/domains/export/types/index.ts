export type JobType = 'excel_odevler' | 'excel_yoklama' | 'excel_mufredat' | 'excel_notlar' | 'excel_sinif_ogrencileri'
export type JobStatus = 'pending' | 'processing' | 'done' | 'error' | 'cancelled' | 'dead_letter'

export interface ExportJob {
  id: string
  school_id: string
  user_id: string
  job_type: JobType
  status: JobStatus
  params: Record<string, string>
  result_url: string | null
  error_msg: string | null
  progress: number
  progress_step: string | null
  cancelled_at: string | null
  inngest_event_id: string | null
  dead_letter_reason: string | null
  attempt: number
  created_at: string
  updated_at: string
}
