import { createClient } from '@/src/infrastructure/supabase/server'

export type AuditAction =
  | 'login'
  | 'logout'
  | 'class.create'
  | 'class.delete'
  | 'class.restore'
  | 'student.create'
  | 'student.delete'
  | 'student.restore'
  | 'homework.create'
  | 'homework.delete'
  | 'homework.restore'
  | 'meeting.create'
  | 'meeting.update'
  | 'meeting.delete'
  | 'meeting.restore'
  | 'exam.create'
  | 'exam.delete'
  | 'exam.restore'
  | 'attendance.save'
  | 'profile.update'
  | 'password.change'
  | 'token.revoke'
  | 'token.generate'

interface AuditEntry {
  user_id: string
  action: AuditAction
  table_name?: string
  record_id?: string
  new_data?: Record<string, unknown>
  school_id?: string
}

export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    const supabase = await createClient()
    await supabase.from('audit_logs').insert({
      user_id: entry.user_id,
      action: entry.action,
      table_name: entry.table_name ?? null,
      record_id: entry.record_id ?? null,
      new_data: entry.new_data ?? null,
      school_id: entry.school_id ?? null,
    })
  } catch {
    // Audit log hatası hiçbir zaman iş akışını durdurmamalı
  }
}
