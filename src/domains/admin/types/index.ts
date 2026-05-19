export type SchoolStatus = 'active' | 'suspended' | 'trial' | 'cancelled'
export type SchoolPlan   = 'free' | 'starter' | 'pro' | 'enterprise'

export interface SchoolQuota {
  school_id:       string
  max_teachers:    number
  max_students:    number
  max_storage_mb:  number
  used_storage_mb: number
  updated_at:      string
}

export interface TenantMetrics {
  school_id:        string
  school_name:      string
  status:           SchoolStatus
  plan:             SchoolPlan
  created_at:       string
  trial_ends_at:    string | null
  teacher_count:    number
  student_count:    number
  max_teachers:     number
  max_students:     number
  used_storage_mb:  number
  max_storage_mb:   number
  failed_exports_7d: number
}

export interface QuotaCheckResult {
  allowed:   boolean
  reason?:   'teacher_limit' | 'student_limit' | 'storage_limit' | 'suspended'
  current:   number
  max:       number
}
