export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      announcement_reads: {
        Row: {
          announcement_id: string
          id: string
          read_at: string | null
          user_id: string
        }
        Insert: {
          announcement_id: string
          id?: string
          read_at?: string | null
          user_id: string
        }
        Update: {
          announcement_id?: string
          id?: string
          read_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcement_reads_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          created_at: string | null
          created_by: string
          id: string
          message: string
          school_id: string
          target_roles: string[]
        }
        Insert: {
          created_at?: string | null
          created_by: string
          id?: string
          message: string
          school_id: string
          target_roles: string[]
        }
        Update: {
          created_at?: string | null
          created_by?: string
          id?: string
          message?: string
          school_id?: string
          target_roles?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "announcements_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "tenant_metrics"
            referencedColumns: ["school_id"]
          },
        ]
      }
      annual_plans: {
        Row: {
          academic_year: string
          approved_at: string | null
          created_at: string
          id: string
          school_id: string
          subject: string
          teacher_id: string
          weekly_plan: Json
        }
        Insert: {
          academic_year: string
          approved_at?: string | null
          created_at?: string
          id?: string
          school_id: string
          subject: string
          teacher_id: string
          weekly_plan?: Json
        }
        Update: {
          academic_year?: string
          approved_at?: string | null
          created_at?: string
          id?: string
          school_id?: string
          subject?: string
          teacher_id?: string
          weekly_plan?: Json
        }
        Relationships: [
          {
            foreignKeyName: "annual_plans_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "annual_plans_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "tenant_metrics"
            referencedColumns: ["school_id"]
          },
        ]
      }
      attendance: {
        Row: {
          class_id: string
          created_at: string
          date: string
          id: string
          notified_at: string | null
          school_id: string
          status: string
          student_id: string
          teacher_id: string
        }
        Insert: {
          class_id: string
          created_at?: string
          date: string
          id?: string
          notified_at?: string | null
          school_id: string
          status?: string
          student_id: string
          teacher_id: string
        }
        Update: {
          class_id?: string
          created_at?: string
          date?: string
          id?: string
          notified_at?: string | null
          school_id?: string
          status?: string
          student_id?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "active_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "tenant_metrics"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "active_students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          correlation_id: string | null
          created_at: string
          duration_ms: number | null
          id: string
          ip_address: string | null
          new_data: Json | null
          old_data: Json | null
          record_id: string | null
          school_id: string | null
          school_name: string | null
          table_name: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          correlation_id?: string | null
          created_at?: string
          duration_ms?: number | null
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          school_id?: string | null
          school_name?: string | null
          table_name?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          correlation_id?: string | null
          created_at?: string
          duration_ms?: number | null
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          school_id?: string | null
          school_name?: string | null
          table_name?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      classes: {
        Row: {
          academic_year: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          grade: number
          id: string
          mentor_teacher_id: string | null
          name: string
          school_id: string
        }
        Insert: {
          academic_year?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          grade: number
          id?: string
          mentor_teacher_id?: string | null
          name: string
          school_id: string
        }
        Update: {
          academic_year?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          grade?: number
          id?: string
          mentor_teacher_id?: string | null
          name?: string
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "classes_mentor_teacher_id_fkey"
            columns: ["mentor_teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "tenant_metrics"
            referencedColumns: ["school_id"]
          },
        ]
      }
      common_exams: {
        Row: {
          created_at: string
          created_by: string
          deleted_at: string | null
          deleted_by: string | null
          exam_date: string
          id: string
          school_id: string
          subject: string
          title: string
        }
        Insert: {
          created_at?: string
          created_by: string
          deleted_at?: string | null
          deleted_by?: string | null
          exam_date: string
          id?: string
          school_id: string
          subject: string
          title: string
        }
        Update: {
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          deleted_by?: string | null
          exam_date?: string
          id?: string
          school_id?: string
          subject?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "common_exams_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "common_exams_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "common_exams_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "tenant_metrics"
            referencedColumns: ["school_id"]
          },
        ]
      }
      curriculum_progress: {
        Row: {
          class_id: string
          completed: boolean
          completion_date: string | null
          created_at: string
          id: string
          outcome_id: string | null
          school_id: string
          status: string
          teacher_id: string
          topic: string
          week_number: number | null
        }
        Insert: {
          class_id: string
          completed?: boolean
          completion_date?: string | null
          created_at?: string
          id?: string
          outcome_id?: string | null
          school_id: string
          status?: string
          teacher_id: string
          topic: string
          week_number?: number | null
        }
        Update: {
          class_id?: string
          completed?: boolean
          completion_date?: string | null
          created_at?: string
          id?: string
          outcome_id?: string | null
          school_id?: string
          status?: string
          teacher_id?: string
          topic?: string
          week_number?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "curriculum_progress_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "active_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curriculum_progress_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curriculum_progress_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curriculum_progress_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "tenant_metrics"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "curriculum_progress_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_plans: {
        Row: {
          class_id: string
          conclusion_text: string
          created_at: string
          deleted_at: string | null
          development_text: string
          id: string
          intro_text: string
          lesson_hour: number
          materials: string[]
          methods: string[]
          objectives: string[]
          plan_date: string
          school_id: string
          teacher_id: string
          topic: string
          unit: string
        }
        Insert: {
          class_id: string
          conclusion_text: string
          created_at?: string
          deleted_at?: string | null
          development_text: string
          id?: string
          intro_text: string
          lesson_hour: number
          materials?: string[]
          methods?: string[]
          objectives?: string[]
          plan_date: string
          school_id: string
          teacher_id: string
          topic: string
          unit: string
        }
        Update: {
          class_id?: string
          conclusion_text?: string
          created_at?: string
          deleted_at?: string | null
          development_text?: string
          id?: string
          intro_text?: string
          lesson_hour?: number
          materials?: string[]
          methods?: string[]
          objectives?: string[]
          plan_date?: string
          school_id?: string
          teacher_id?: string
          topic?: string
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_plans_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "active_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_plans_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_plans_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_plans_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "tenant_metrics"
            referencedColumns: ["school_id"]
          },
        ]
      }
      exam_entries: {
        Row: {
          created_at: string
          exam_id: string
          grade: number
          id: string
          name: string | null
          school_id: string
          student_id: string | null
        }
        Insert: {
          created_at?: string
          exam_id: string
          grade: number
          id?: string
          name?: string | null
          school_id: string
          student_id?: string | null
        }
        Update: {
          created_at?: string
          exam_id?: string
          grade?: number
          id?: string
          name?: string | null
          school_id?: string
          student_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exam_entries_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "common_exams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_entries_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_entries_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "tenant_metrics"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "exam_entries_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "active_students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_entries_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      export_jobs: {
        Row: {
          attempt: number | null
          cancelled_at: string | null
          created_at: string
          dead_letter_reason: string | null
          error_msg: string | null
          id: string
          inngest_event_id: string | null
          job_type: string
          params: Json
          progress: number | null
          progress_step: string | null
          result_url: string | null
          school_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attempt?: number | null
          cancelled_at?: string | null
          created_at?: string
          dead_letter_reason?: string | null
          error_msg?: string | null
          id?: string
          inngest_event_id?: string | null
          job_type: string
          params?: Json
          progress?: number | null
          progress_step?: string | null
          result_url?: string | null
          school_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attempt?: number | null
          cancelled_at?: string | null
          created_at?: string
          dead_letter_reason?: string | null
          error_msg?: string | null
          id?: string
          inngest_event_id?: string | null
          job_type?: string
          params?: Json
          progress?: number | null
          progress_step?: string | null
          result_url?: string | null
          school_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "export_jobs_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "export_jobs_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "tenant_metrics"
            referencedColumns: ["school_id"]
          },
        ]
      }
      grade_columns: {
        Row: {
          class_id: string
          created_at: string
          exam_date: string | null
          grade_type: string
          id: string
          max_score: number
          school_id: string
          teacher_id: string
          title: string
        }
        Insert: {
          class_id: string
          created_at?: string
          exam_date?: string | null
          grade_type: string
          id?: string
          max_score?: number
          school_id: string
          teacher_id: string
          title: string
        }
        Update: {
          class_id?: string
          created_at?: string
          exam_date?: string | null
          grade_type?: string
          id?: string
          max_score?: number
          school_id?: string
          teacher_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "grade_columns_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "active_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grade_columns_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grade_columns_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grade_columns_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "tenant_metrics"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "grade_columns_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      grade_entries: {
        Row: {
          grade_column_id: string
          id: string
          school_id: string
          score: number | null
          student_id: string
          updated_at: string
        }
        Insert: {
          grade_column_id: string
          id?: string
          school_id: string
          score?: number | null
          student_id: string
          updated_at?: string
        }
        Update: {
          grade_column_id?: string
          id?: string
          school_id?: string
          score?: number | null
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "grade_entries_grade_column_id_fkey"
            columns: ["grade_column_id"]
            isOneToOne: false
            referencedRelation: "grade_columns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grade_entries_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grade_entries_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "tenant_metrics"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "grade_entries_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "active_students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grade_entries_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      homework_sources: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          school_id: string
          subject: string | null
          teacher_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          school_id: string
          subject?: string | null
          teacher_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          school_id?: string
          subject?: string | null
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "homework_sources_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homework_sources_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "tenant_metrics"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "homework_sources_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      homework_submission_logs: {
        Row: {
          changed_at: string
          changed_by: string
          homework_id: string
          id: string
          new_status: string
          old_status: string | null
          school_id: string
          student_id: string
        }
        Insert: {
          changed_at?: string
          changed_by: string
          homework_id: string
          id?: string
          new_status: string
          old_status?: string | null
          school_id: string
          student_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string
          homework_id?: string
          id?: string
          new_status?: string
          old_status?: string | null
          school_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "homework_submission_logs_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homework_submission_logs_homework_id_fkey"
            columns: ["homework_id"]
            isOneToOne: false
            referencedRelation: "active_homeworks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homework_submission_logs_homework_id_fkey"
            columns: ["homework_id"]
            isOneToOne: false
            referencedRelation: "homeworks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homework_submission_logs_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homework_submission_logs_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "tenant_metrics"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "homework_submission_logs_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "active_students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homework_submission_logs_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      homework_submissions: {
        Row: {
          homework_id: string
          id: string
          note: string | null
          school_id: string
          status: string
          student_id: string
          updated_at: string
        }
        Insert: {
          homework_id: string
          id?: string
          note?: string | null
          school_id: string
          status?: string
          student_id: string
          updated_at?: string
        }
        Update: {
          homework_id?: string
          id?: string
          note?: string | null
          school_id?: string
          status?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "homework_submissions_homework_id_fkey"
            columns: ["homework_id"]
            isOneToOne: false
            referencedRelation: "active_homeworks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homework_submissions_homework_id_fkey"
            columns: ["homework_id"]
            isOneToOne: false
            referencedRelation: "homeworks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homework_submissions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homework_submissions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "tenant_metrics"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "homework_submissions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "active_students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homework_submissions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      homework_veli_notifications: {
        Row: {
          homework_id: string
          sent_at: string
          student_id: string
        }
        Insert: {
          homework_id: string
          sent_at?: string
          student_id: string
        }
        Update: {
          homework_id?: string
          sent_at?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "homework_veli_notifications_homework_id_fkey"
            columns: ["homework_id"]
            isOneToOne: false
            referencedRelation: "active_homeworks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homework_veli_notifications_homework_id_fkey"
            columns: ["homework_id"]
            isOneToOne: false
            referencedRelation: "homeworks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homework_veli_notifications_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "active_students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homework_veli_notifications_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      homeworks: {
        Row: {
          assigned_date: string
          class_id: string
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          description: string | null
          due_date: string | null
          id: string
          is_template: boolean
          school_id: string
          source_id: string | null
          subject: string
          teacher_id: string
          title: string
        }
        Insert: {
          assigned_date?: string
          class_id: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          is_template?: boolean
          school_id: string
          source_id?: string | null
          subject: string
          teacher_id: string
          title: string
        }
        Update: {
          assigned_date?: string
          class_id?: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          is_template?: boolean
          school_id?: string
          source_id?: string | null
          subject?: string
          teacher_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "homeworks_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "active_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homeworks_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homeworks_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homeworks_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "tenant_metrics"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "homeworks_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "homework_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homeworks_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      kanaat_notlari: {
        Row: {
          class_id: string
          created_at: string
          donem: string
          id: string
          school_id: string
          score: number
          student_id: string
          teacher_id: string
          text: string
          updated_at: string
        }
        Insert: {
          class_id: string
          created_at?: string
          donem: string
          id?: string
          school_id: string
          score: number
          student_id: string
          teacher_id: string
          text: string
          updated_at?: string
        }
        Update: {
          class_id?: string
          created_at?: string
          donem?: string
          id?: string
          school_id?: string
          score?: number
          student_id?: string
          teacher_id?: string
          text?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kanaat_notlari_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "active_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kanaat_notlari_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kanaat_notlari_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "active_students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kanaat_notlari_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kanaat_notlari_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_schedules: {
        Row: {
          class_id: string | null
          created_at: string
          created_by: string | null
          file_name: string | null
          file_url: string | null
          id: string
          period_count: number
          schedule_type: string
          school_id: string
          slots: Json
          teacher_id: string | null
          title: string | null
          type_label: string
          updated_at: string
        }
        Insert: {
          class_id?: string | null
          created_at?: string
          created_by?: string | null
          file_name?: string | null
          file_url?: string | null
          id?: string
          period_count?: number
          schedule_type?: string
          school_id: string
          slots?: Json
          teacher_id?: string | null
          title?: string | null
          type_label?: string
          updated_at?: string
        }
        Update: {
          class_id?: string | null
          created_at?: string
          created_by?: string | null
          file_name?: string | null
          file_url?: string | null
          id?: string
          period_count?: number
          schedule_type?: string
          school_id?: string
          slots?: Json
          teacher_id?: string | null
          title?: string | null
          type_label?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_schedules_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "active_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_schedules_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_schedules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_schedules_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_schedules_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "tenant_metrics"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "lesson_schedules_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      mentor_reports: {
        Row: {
          class_id: string
          content: string
          created_at: string
          id: string
          mentor_id: string
          report_date: string
          school_id: string
          student_id: string
        }
        Insert: {
          class_id: string
          content: string
          created_at?: string
          id?: string
          mentor_id: string
          report_date?: string
          school_id: string
          student_id: string
        }
        Update: {
          class_id?: string
          content?: string
          created_at?: string
          id?: string
          mentor_id?: string
          report_date?: string
          school_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mentor_reports_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "active_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mentor_reports_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mentor_reports_mentor_id_fkey"
            columns: ["mentor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mentor_reports_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mentor_reports_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "tenant_metrics"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "mentor_reports_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "active_students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mentor_reports_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      mentor_student_notes: {
        Row: {
          content: string
          created_at: string
          id: string
          mentor_student_id: string
          school_id: string
          teacher_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          mentor_student_id: string
          school_id: string
          teacher_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          mentor_student_id?: string
          school_id?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mentor_student_notes_mentor_student_id_fkey"
            columns: ["mentor_student_id"]
            isOneToOne: false
            referencedRelation: "mentor_students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mentor_student_notes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mentor_student_notes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "tenant_metrics"
            referencedColumns: ["school_id"]
          },
        ]
      }
      mentor_students: {
        Row: {
          created_at: string
          full_name: string
          id: string
          parent_name: string | null
          phone: string | null
          school_id: string
          teacher_id: string
        }
        Insert: {
          created_at?: string
          full_name: string
          id?: string
          parent_name?: string | null
          phone?: string | null
          school_id: string
          teacher_id: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          parent_name?: string | null
          phone?: string | null
          school_id?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mentor_students_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mentor_students_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "tenant_metrics"
            referencedColumns: ["school_id"]
          },
        ]
      }
      notebook_checks: {
        Row: {
          check_date: string
          class_id: string
          created_at: string
          id: string
          notes: string | null
          school_id: string
          teacher_id: string
        }
        Insert: {
          check_date: string
          class_id: string
          created_at?: string
          id?: string
          notes?: string | null
          school_id: string
          teacher_id: string
        }
        Update: {
          check_date?: string
          class_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          school_id?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notebook_checks_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "active_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notebook_checks_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notebook_checks_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notebook_checks_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "tenant_metrics"
            referencedColumns: ["school_id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          days_before: number
          email_on: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          days_before?: number
          email_on?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          days_before?: number
          email_on?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          homework_id: string | null
          id: string
          read_at: string | null
          school_id: string
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          homework_id?: string | null
          id?: string
          read_at?: string | null
          school_id: string
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          homework_id?: string | null
          id?: string
          read_at?: string | null
          school_id?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_homework_id_fkey"
            columns: ["homework_id"]
            isOneToOne: false
            referencedRelation: "active_homeworks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_homework_id_fkey"
            columns: ["homework_id"]
            isOneToOne: false
            referencedRelation: "homeworks"
            referencedColumns: ["id"]
          },
        ]
      }
      ogretmen_dosyasi: {
        Row: {
          academic_year: string
          checked_items: string[]
          school_id: string
          teacher_id: string
          updated_at: string
        }
        Insert: {
          academic_year: string
          checked_items?: string[]
          school_id: string
          teacher_id: string
          updated_at?: string
        }
        Update: {
          academic_year?: string
          checked_items?: string[]
          school_id?: string
          teacher_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ogretmen_dosyasi_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ogretmen_dosyasi_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "tenant_metrics"
            referencedColumns: ["school_id"]
          },
        ]
      }
      parent_contact_logs: {
        Row: {
          contact_method: string
          contacted_at: string
          created_at: string
          id: string
          note: string
          school_id: string
          student_id: string
          teacher_id: string
        }
        Insert: {
          contact_method?: string
          contacted_at?: string
          created_at?: string
          id?: string
          note: string
          school_id: string
          student_id: string
          teacher_id: string
        }
        Update: {
          contact_method?: string
          contacted_at?: string
          created_at?: string
          id?: string
          note?: string
          school_id?: string
          student_id?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "parent_contact_logs_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "active_students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_contact_logs_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_contact_logs_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          action: string
          description: string | null
          id: string
          resource: string
          scope: string
        }
        Insert: {
          action: string
          description?: string | null
          id?: string
          resource: string
          scope: string
        }
        Update: {
          action?: string
          description?: string | null
          id?: string
          resource?: string
          scope?: string
        }
        Relationships: []
      }
      platform_admins: {
        Row: {
          created_at: string
          email: string
          id: string
        }
        Insert: {
          created_at?: string
          email: string
          id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          id: string
          role: string
          school_id: string | null
          subject: string | null
        }
        Insert: {
          created_at?: string
          full_name: string
          id: string
          role?: string
          school_id?: string | null
          subject?: string | null
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          role?: string
          school_id?: string | null
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "tenant_metrics"
            referencedColumns: ["school_id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          school_id: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          school_id: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          school_id?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      revoked_tokens: {
        Row: {
          jti: string
          reason: string | null
          revoked_at: string
          revoked_by: string | null
          token_type: string
        }
        Insert: {
          jti: string
          reason?: string | null
          revoked_at?: string
          revoked_by?: string | null
          token_type: string
        }
        Update: {
          jti?: string
          reason?: string | null
          revoked_at?: string
          revoked_by?: string | null
          token_type?: string
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          permission_id: string
          role_id: string
        }
        Insert: {
          permission_id: string
          role_id: string
        }
        Update: {
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string | null
          display_name: string
          id: string
          is_system: boolean | null
          name: string
          school_id: string | null
        }
        Insert: {
          created_at?: string | null
          display_name: string
          id?: string
          is_system?: boolean | null
          name: string
          school_id?: string | null
        }
        Update: {
          created_at?: string | null
          display_name?: string
          id?: string
          is_system?: boolean | null
          name?: string
          school_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "roles_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roles_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "tenant_metrics"
            referencedColumns: ["school_id"]
          },
        ]
      }
      school_meetings: {
        Row: {
          attendees: string | null
          created_at: string
          created_by: string
          id: string
          meeting_date: string
          meeting_type: string
          notes: string | null
          school_id: string
          title: string
        }
        Insert: {
          attendees?: string | null
          created_at?: string
          created_by: string
          id?: string
          meeting_date: string
          meeting_type?: string
          notes?: string | null
          school_id: string
          title: string
        }
        Update: {
          attendees?: string | null
          created_at?: string
          created_by?: string
          id?: string
          meeting_date?: string
          meeting_type?: string
          notes?: string | null
          school_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_meetings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_meetings_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_meetings_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "tenant_metrics"
            referencedColumns: ["school_id"]
          },
        ]
      }
      schools: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string | null
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string | null
          status?: string
        }
        Relationships: []
      }
      sok_reports: {
        Row: {
          academic_year: string
          agenda_items: Json
          class_id: string
          created_at: string
          decisions: Json
          deleted_at: string | null
          id: string
          meeting_date: string
          participants: Json
          school_id: string
          student_notes: Json
          teacher_id: string
          term: number
        }
        Insert: {
          academic_year: string
          agenda_items?: Json
          class_id: string
          created_at?: string
          decisions?: Json
          deleted_at?: string | null
          id?: string
          meeting_date: string
          participants?: Json
          school_id: string
          student_notes?: Json
          teacher_id: string
          term: number
        }
        Update: {
          academic_year?: string
          agenda_items?: Json
          class_id?: string
          created_at?: string
          decisions?: Json
          deleted_at?: string | null
          id?: string
          meeting_date?: string
          participants?: Json
          school_id?: string
          student_notes?: Json
          teacher_id?: string
          term?: number
        }
        Relationships: [
          {
            foreignKeyName: "sok_reports_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "active_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sok_reports_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sok_reports_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sok_reports_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "tenant_metrics"
            referencedColumns: ["school_id"]
          },
        ]
      }
      student_notes: {
        Row: {
          body: string
          created_at: string
          id: string
          school_id: string
          student_id: string
          teacher_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          school_id: string
          student_id: string
          teacher_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          school_id?: string
          student_id?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_notes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_notes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "tenant_metrics"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "student_notes_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "active_students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_notes_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_notes_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      student_risk_history: {
        Row: {
          absences: number
          hw_misses: number
          id: string
          risk_level: string
          risk_score: number
          school_id: string
          snapshot_at: string
          student_id: string
          teacher_id: string
        }
        Insert: {
          absences?: number
          hw_misses?: number
          id?: string
          risk_level: string
          risk_score: number
          school_id: string
          snapshot_at?: string
          student_id: string
          teacher_id: string
        }
        Update: {
          absences?: number
          hw_misses?: number
          id?: string
          risk_level?: string
          risk_score?: number
          school_id?: string
          snapshot_at?: string
          student_id?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_risk_history_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_risk_history_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "tenant_metrics"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "student_risk_history_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "active_students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_risk_history_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          class_id: string
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          full_name: string
          id: string
          school_id: string
          student_number: string | null
          veli_ad: string | null
          veli_email: string | null
          veli_email_opt_out: boolean
          veli_telefon: string | null
        }
        Insert: {
          class_id: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          full_name: string
          id?: string
          school_id: string
          student_number?: string | null
          veli_ad?: string | null
          veli_email?: string | null
          veli_email_opt_out?: boolean
          veli_telefon?: string | null
        }
        Update: {
          class_id?: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          full_name?: string
          id?: string
          school_id?: string
          student_number?: string | null
          veli_ad?: string | null
          veli_email?: string | null
          veli_email_opt_out?: boolean
          veli_telefon?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "students_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "active_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "tenant_metrics"
            referencedColumns: ["school_id"]
          },
        ]
      }
      teacher_activity_log: {
        Row: {
          action: string
          created_at: string
          id: string
          meta: Json | null
          school_id: string
          teacher_id: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          meta?: Json | null
          school_id: string
          teacher_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          meta?: Json | null
          school_id?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_activity_log_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_activity_log_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "tenant_metrics"
            referencedColumns: ["school_id"]
          },
        ]
      }
      teacher_classes: {
        Row: {
          class_id: string
          teacher_id: string
        }
        Insert: {
          class_id: string
          teacher_id: string
        }
        Update: {
          class_id?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_classes_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "active_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_classes_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_classes_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_notes: {
        Row: {
          content: string
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_permissions: {
        Row: {
          granted: boolean | null
          granted_at: string | null
          granted_by: string | null
          permission_id: string
          school_id: string | null
          user_id: string
        }
        Insert: {
          granted?: boolean | null
          granted_at?: string | null
          granted_by?: string | null
          permission_id: string
          school_id?: string | null
          user_id: string
        }
        Update: {
          granted?: boolean | null
          granted_at?: string | null
          granted_by?: string | null
          permission_id?: string
          school_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_permissions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_permissions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "tenant_metrics"
            referencedColumns: ["school_id"]
          },
        ]
      }
      user_roles: {
        Row: {
          expires_at: string | null
          granted_at: string | null
          granted_by: string | null
          role_id: string
          school_id: string | null
          user_id: string
        }
        Insert: {
          expires_at?: string | null
          granted_at?: string | null
          granted_by?: string | null
          role_id: string
          school_id?: string | null
          user_id: string
        }
        Update: {
          expires_at?: string | null
          granted_at?: string | null
          granted_by?: string | null
          role_id?: string
          school_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "tenant_metrics"
            referencedColumns: ["school_id"]
          },
        ]
      }
      user_sessions: {
        Row: {
          created_at: string
          duration_minutes: number | null
          id: string
          last_seen_at: string
          login_at: string
          logout_at: string | null
          school_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          duration_minutes?: number | null
          id?: string
          last_seen_at?: string
          login_at?: string
          logout_at?: string | null
          school_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          duration_minutes?: number | null
          id?: string
          last_seen_at?: string
          login_at?: string
          logout_at?: string | null
          school_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_sessions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_sessions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "tenant_metrics"
            referencedColumns: ["school_id"]
          },
        ]
      }
      veli_tokens: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          issued_by: string
          jti: string
          school_id: string
          student_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          issued_by: string
          jti: string
          school_id: string
          student_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          issued_by?: string
          jti?: string
          school_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "veli_tokens_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "veli_tokens_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "tenant_metrics"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "veli_tokens_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "active_students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "veli_tokens_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      zumre_meeting_templates: {
        Row: {
          attendees_template: string | null
          created_at: string | null
          created_by: string | null
          id: string
          meeting_type: string
          notes_template: string | null
          school_id: string
          title: string
          updated_at: string | null
        }
        Insert: {
          attendees_template?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          meeting_type: string
          notes_template?: string | null
          school_id: string
          title: string
          updated_at?: string | null
        }
        Update: {
          attendees_template?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          meeting_type?: string
          notes_template?: string | null
          school_id?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "zumre_meeting_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zumre_meeting_templates_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zumre_meeting_templates_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "tenant_metrics"
            referencedColumns: ["school_id"]
          },
        ]
      }
      zumre_meetings: {
        Row: {
          attendees: string | null
          branch: string | null
          created_at: string
          created_by: string
          deleted_at: string | null
          deleted_by: string | null
          id: string
          meeting_date: string
          meeting_type: string
          notes: string | null
          school_id: string
          title: string
        }
        Insert: {
          attendees?: string | null
          branch?: string | null
          created_at?: string
          created_by: string
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          meeting_date: string
          meeting_type?: string
          notes?: string | null
          school_id: string
          title: string
        }
        Update: {
          attendees?: string | null
          branch?: string | null
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          meeting_date?: string
          meeting_type?: string
          notes?: string | null
          school_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "zumre_meetings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zumre_meetings_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zumre_meetings_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "tenant_metrics"
            referencedColumns: ["school_id"]
          },
        ]
      }
    }
    Views: {
      active_classes: {
        Row: {
          academic_year: string | null
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          grade: number | null
          id: string | null
          name: string | null
          school_id: string | null
        }
        Insert: {
          academic_year?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          grade?: number | null
          id?: string | null
          name?: string | null
          school_id?: string | null
        }
        Update: {
          academic_year?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          grade?: number | null
          id?: string | null
          name?: string | null
          school_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "classes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "tenant_metrics"
            referencedColumns: ["school_id"]
          },
        ]
      }
      active_homeworks: {
        Row: {
          assigned_date: string | null
          class_id: string | null
          created_at: string | null
          deleted_at: string | null
          deleted_by: string | null
          description: string | null
          due_date: string | null
          id: string | null
          school_id: string | null
          subject: string | null
          teacher_id: string | null
          title: string | null
        }
        Insert: {
          assigned_date?: string | null
          class_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string | null
          school_id?: string | null
          subject?: string | null
          teacher_id?: string | null
          title?: string | null
        }
        Update: {
          assigned_date?: string | null
          class_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string | null
          school_id?: string | null
          subject?: string | null
          teacher_id?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "homeworks_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "active_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homeworks_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homeworks_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homeworks_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "tenant_metrics"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "homeworks_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      active_students: {
        Row: {
          class_id: string | null
          created_at: string | null
          deleted_at: string | null
          deleted_by: string | null
          full_name: string | null
          id: string | null
          school_id: string | null
          student_number: string | null
        }
        Insert: {
          class_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          full_name?: string | null
          id?: string | null
          school_id?: string | null
          student_number?: string | null
        }
        Update: {
          class_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          full_name?: string | null
          id?: string | null
          school_id?: string | null
          student_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "students_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "active_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "tenant_metrics"
            referencedColumns: ["school_id"]
          },
        ]
      }
      tenant_metrics: {
        Row: {
          class_count: number | null
          created_at: string | null
          homework_count: number | null
          mudur_count: number | null
          school_id: string | null
          school_name: string | null
          slug: string | null
          status: string | null
          student_count: number | null
          teacher_count: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_onboard_user: {
        Args: { p_id: string; p_role?: string; p_school_id: string }
        Returns: undefined
      }
      admin_set_profile: {
        Args: {
          p_full_name: string
          p_id: string
          p_role: string
          p_school_id: string
          p_subject: string
        }
        Returns: undefined
      }
      assign_user_role: {
        Args: { new_role: string; target_id: string }
        Returns: undefined
      }
      can_manage_classes: { Args: never; Returns: boolean }
      can_manage_zumre_item: { Args: { item_branch: string }; Returns: boolean }
      can_revoke_tokens: { Args: never; Returns: boolean }
      can_see_zumre_item: { Args: { item_branch: string }; Returns: boolean }
      current_school_id: { Args: never; Returns: string }
      delete_school: { Args: { p_school_id: string }; Returns: undefined }
      find_school_by_slug: {
        Args: { p_slug: string }
        Returns: {
          id: string
          name: string
        }[]
      }
      get_first_unread_announcement: {
        Args: { p_school_id: string; p_user_id: string; p_user_role: string }
        Returns: Database["public"]["CompositeTypes"]["unread_announcement_row"][]
        SetofOptions: {
          from: "*"
          to: "unread_announcement_row"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_user_permissions: {
        Args: { p_school_id?: string; p_user_id: string }
        Returns: {
          action: string
          resource: string
          scope: string
          source: string
        }[]
      }
      has_permission: {
        Args: {
          p_action: string
          p_resource: string
          p_school_id?: string
          p_user_id: string
        }
        Returns: boolean
      }
      is_mudur_in_school: { Args: never; Returns: boolean }
      is_school_member: { Args: { p_school_id: string }; Returns: boolean }
      is_yonetici_in_school: { Args: never; Returns: boolean }
      is_zumre_baskani: { Args: never; Returns: boolean }
      is_zumre_baskani_in_school: { Args: never; Returns: boolean }
      permission_scope: {
        Args: {
          p_action: string
          p_resource: string
          p_school_id?: string
          p_user_id: string
        }
        Returns: string
      }
      restore_record: {
        Args: { p_id: string; p_table: string }
        Returns: undefined
      }
      soft_delete: {
        Args: { p_id: string; p_table: string }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      unread_announcement_row: {
        id: string | null
        school_id: string | null
        message: string | null
        created_by: string | null
        sender_name: string | null
        target_roles: string[] | null
        created_at: string | null
      }
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
