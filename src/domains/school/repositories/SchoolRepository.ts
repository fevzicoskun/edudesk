import { createClient } from '@/src/shared/supabase/server'
import { createServiceClient } from '@/src/shared/supabase/service'

export const SchoolRepository = {
  async updateSchool(schoolId: string, data: Partial<{ name: string; slug: string }>) {
    const admin = createServiceClient()
    return admin.from('schools').update(data).eq('id', schoolId)
  },

  async findProfileSchool(userId: string) {
    const supabase = await createClient()
    return supabase.from('profiles').select('school_id').eq('id', userId).single()
  },

  async insertSchool(name: string, slug: string) {
    const supabase = await createClient()
    return supabase.from('schools').insert({ name, slug }).select('id').single()
  },

  async adminOnboardUser(params: { p_id: string; p_school_id: string; p_role?: string }) {
    const admin = createServiceClient()
    return admin.rpc('admin_onboard_user', params)
  },

  async findSchoolBySlug(slug: string) {
    const supabase = await createClient()
    return supabase.rpc('find_school_by_slug', { p_slug: slug.toLowerCase().trim() })
  },
}
