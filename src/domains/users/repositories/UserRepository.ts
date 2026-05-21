import { createClient } from '@/src/infrastructure/supabase/server'
import { createServiceClient } from '@/src/infrastructure/supabase/service'

export const UserRepository = {
  async createAuthUser(email: string, password: string, fullName: string) {
    const admin = createServiceClient()
    return admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    })
  },

  async deleteAuthUser(userId: string) {
    const admin = createServiceClient()
    return admin.auth.admin.deleteUser(userId)
  },

  async adminSetProfile(params: {
    p_id: string
    p_full_name: string
    p_subject: string
    p_role: string
    p_school_id: string
  }) {
    const admin = createServiceClient()
    return admin.rpc('admin_set_profile', params)
  },

  async getProfileById(targetId: string) {
    const admin = createServiceClient()
    return admin.from('profiles').select('role, school_id').eq('id', targetId).single()
  },

  async updateProfile(userId: string, data: { full_name: string; subject: string | null }) {
    const supabase = await createClient()
    return supabase.from('profiles').update(data).eq('id', userId)
  },

  async assignRole(targetId: string, newRole: string) {
    const supabase = await createClient()
    return supabase.rpc('assign_user_role', {
      target_id: targetId,
      new_role: newRole,
    })
  },

  async getCurrentUser() {
    const supabase = await createClient()
    return supabase.auth.getUser()
  },
}
