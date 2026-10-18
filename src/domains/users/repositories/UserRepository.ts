import { createClient } from '@/src/infrastructure/supabase/server'
import { createServiceClient } from '@/src/infrastructure/supabase/service'
import { logger } from '@/src/infrastructure/observability/logger'

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

  /** Hesap silinince CASCADE ile kalıcı giden / sahipsiz kalan veriler (2026-10-10 veri bütünlüğü taraması). */
  async sahipOlunanVeri(userId: string) {
    const admin = createServiceClient()
    const say = async (q: PromiseLike<{ count: number | null; error: { message: string } | null }>) => {
      const { count, error } = await q
      if (error) throw new Error(error.message) // sayılamazsa silme de yapılmasın
      return count ?? 0
    }
    const [odev, mentorluk, dersProgrami, nobet, ogrenciNotu] = await Promise.all([
      say(admin.from('homeworks').select('id', { count: 'exact', head: true }).eq('teacher_id', userId).is('deleted_at', null)),
      say(admin.from('mentorships').select('id', { count: 'exact', head: true }).eq('mentor_id', userId)),
      say(admin.from('lesson_schedules').select('id', { count: 'exact', head: true }).eq('teacher_id', userId)),
      say(admin.from('teacher_duties').select('id', { count: 'exact', head: true }).eq('teacher_id', userId)),
      say(admin.from('student_notes').select('id', { count: 'exact', head: true }).eq('teacher_id', userId)),
    ])
    return { odev, mentorluk, dersProgrami, nobet, ogrenciNotu }
  },

  /** Giriş e-postasını değiştirir; hesap id'si (ve tüm veri) aynı kalır. email_confirm → onay maili GİTMEZ. */
  async updateAuthEmail(userId: string, email: string) {
    const admin = createServiceClient()
    return admin.auth.admin.updateUserById(userId, { email, email_confirm: true })
  },

  /** E-postalar auth.users'ta — RLS'li client göremez. */
  async getAuthEmails(userIds: string[]): Promise<Record<string, string>> {
    const admin = createServiceClient()
    // Kullanıcı başına istek yerine sayfalı toplu liste (1000/sayfa); tüm okulların hesapları gelir, istenenler süzülür.
    // Okunamazsa eskisi gibi sayfa açılır, e-postalar eksik kalır.
    const istenen = new Set(userIds)
    const eposta: Record<string, string> = {}
    for (let page = 1; ; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
      if (error) {
        logger.error({ event: 'auth_eposta_okunamadi', err: error.message }, 'Kullanıcı e-postaları okunamadı')
        break
      }
      for (const u of data.users) if (u.email && istenen.has(u.id)) eposta[u.id] = u.email
      if (data.users.length < 1000) break
    }
    return eposta
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
