import { createClient } from '@/src/infrastructure/supabase/server'
import { createServiceClient } from '@/src/infrastructure/supabase/service'

export const AuthRepository = {
  async signInWithPassword(email: string, password: string) {
    const supabase = await createClient()
    return supabase.auth.signInWithPassword({ email, password })
  },

  async signOut() {
    const supabase = await createClient()
    return supabase.auth.signOut()
  },

  async signUp(email: string, password: string, fullName: string) {
    const supabase = await createClient()
    return supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    })
  },

  async updateUser(password: string) {
    const supabase = await createClient()
    return supabase.auth.updateUser({ password })
  },

  async getUser() {
    const supabase = await createClient()
    return supabase.auth.getUser()
  },

  async findSchoolByCode(schoolCode: string) {
    const admin = createServiceClient()
    return admin
      .from('schools')
      .select('id')
      .ilike('slug', schoolCode.trim())
      .single()
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
}
