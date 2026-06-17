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

  // ── Öğretmen–Sınıf Atamaları ────────────────────────────────────────────

  async getClassById(classId: string) {
    const admin = createServiceClient()
    return admin
      .from('classes')
      .select('school_id, deleted_at')
      .eq('id', classId)
      .single()
  },

  async getSchoolClasses(schoolId: string) {
    const admin = createServiceClient()
    return admin
      .from('classes')
      .select('id, name, grade')
      .eq('school_id', schoolId)
      .is('deleted_at', null)
      .order('grade')
      .order('name')
  },

  async getSchoolTeacherClasses(classIds: string[]) {
    if (classIds.length === 0) return { data: [] as { teacher_id: string; class_id: string }[], error: null }
    const admin = createServiceClient()
    return admin
      .from('teacher_classes')
      .select('teacher_id, class_id')
      .in('class_id', classIds)
  },

  // Okuldaki sınıf atanabilir öğretmenlerin id'leri (ogretmen + zumre_baskani)
  async getSchoolTeacherIds(schoolId: string) {
    const admin = createServiceClient()
    return admin
      .from('profiles')
      .select('id')
      .eq('school_id', schoolId)
      .in('role', ['ogretmen', 'zumre_baskani'])
  },

  async addTeacherClasses(pairs: { teacher_id: string; class_id: string }[]) {
    const admin = createServiceClient()
    return admin.from('teacher_classes').upsert(pairs, { ignoreDuplicates: true })
  },

  async addTeacherClass(teacherId: string, classId: string) {
    const admin = createServiceClient()
    return admin
      .from('teacher_classes')
      .upsert({ teacher_id: teacherId, class_id: classId }, { ignoreDuplicates: true })
  },

  async removeTeacherClass(teacherId: string, classId: string) {
    const admin = createServiceClient()
    return admin
      .from('teacher_classes')
      .delete()
      .eq('teacher_id', teacherId)
      .eq('class_id', classId)
  },
}
