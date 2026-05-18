import { createClient } from '@/src/shared/supabase/server'
import type { TokenType } from '../types'

export const TokenRepository = {
  async findStudentById(studentId: string, schoolId: string) {
    const supabase = await createClient()
    return supabase
      .from('students')
      .select('id, full_name')
      .eq('id', studentId)
      .eq('school_id', schoolId)
      .single()
  },

  async insertVeliToken(data: {
    student_id: string
    school_id: string
    issued_by: string
    jti: string
    expires_at: string
  }) {
    const supabase = await createClient()
    return supabase.from('veli_tokens').insert(data)
  },

  async insertRevokedToken(data: {
    jti: string
    token_type: TokenType
    revoked_by: string
    reason: string | null
  }) {
    const supabase = await createClient()
    return supabase.from('revoked_tokens').insert(data)
  },

  async listRevokedTokens() {
    const supabase = await createClient()
    return supabase
      .from('revoked_tokens')
      .select('jti, token_type, revoked_at, reason')
      .order('revoked_at', { ascending: false })
      .limit(100)
  },
}
