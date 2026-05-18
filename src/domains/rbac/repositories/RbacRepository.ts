import { createServiceClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase/server'
import type { Resource, Action, GrantedPermission, UserRole } from '../types'

export const RbacRepository = {
  /** Kullanıcının tüm aktif izinlerini DB fonksiyonu üzerinden çeker */
  async getUserPermissions(
    userId: string,
    schoolId: string
  ): Promise<GrantedPermission[]> {
    const db = createServiceClient()
    const { data, error } = await db.rpc('get_user_permissions', {
      p_user_id:   userId,
      p_school_id: schoolId,
    })
    if (error) throw new Error(`İzin sorgusu hatası: ${error.message}`)
    return (data ?? []) as GrantedPermission[]
  },

  /** Tek bir izin kontrolü — DB fonksiyonu üzerinden (RLS'de de kullanılır) */
  async hasPermission(
    userId: string,
    resource: Resource,
    action: Action,
    schoolId?: string
  ): Promise<boolean> {
    const db = createServiceClient()
    const { data, error } = await db.rpc('has_permission', {
      p_user_id:   userId,
      p_resource:  resource,
      p_action:    action,
      p_school_id: schoolId ?? null,
    })
    if (error) return false
    return data === true
  },

  /** Kullanıcının okuldaki aktif rollerini getirir */
  async getUserRoles(userId: string, schoolId: string): Promise<UserRole[]> {
    const db = createServiceClient()
    const { data, error } = await db
      .from('user_roles')
      .select('*, role:roles(*)')
      .eq('user_id', userId)
      .eq('school_id', schoolId)
      .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())
    if (error) throw new Error(`Rol sorgusu hatası: ${error.message}`)
    return (data ?? []) as unknown as UserRole[]
  },

  /** Kullanıcıya okul kapsamında doğrudan izin ver */
  async grantPermission(params: {
    userId:      string
    resource:    Resource
    action:      Action
    schoolId:    string
    grantedBy:   string
    granted?:    boolean
  }): Promise<void> {
    const db = await createClient()
    const { error: permErr } = await db
      .from('permissions')
      .select('id')
      .eq('resource', params.resource)
      .eq('action', params.action)
      .limit(1)
      .single()

    if (permErr) throw new Error('İzin bulunamadı')

    const { data: perm } = await db
      .from('permissions')
      .select('id')
      .eq('resource', params.resource)
      .eq('action', params.action)
      .limit(1)
      .single()

    if (!perm) throw new Error('İzin bulunamadı')

    const { error } = await db.from('user_permissions').upsert({
      user_id:       params.userId,
      permission_id: perm.id,
      school_id:     params.schoolId,
      granted:       params.granted ?? true,
      granted_by:    params.grantedBy,
      granted_at:    new Date().toISOString(),
    }, { onConflict: 'user_id,permission_id,school_id' })

    if (error) throw new Error(`İzin ataması hatası: ${error.message}`)
  },

  /** Kullanıcının doğrudan iznini kaldır (rol izni etkilenmez) */
  async revokeDirectPermission(params: {
    userId:     string
    resource:   Resource
    action:     Action
    schoolId:   string
  }): Promise<void> {
    const db = createServiceClient()
    const { data: perm } = await db
      .from('permissions')
      .select('id')
      .eq('resource', params.resource)
      .eq('action', params.action)
      .limit(1)
      .single()

    if (!perm) return

    await db
      .from('user_permissions')
      .delete()
      .eq('user_id', params.userId)
      .eq('permission_id', perm.id)
      .eq('school_id', params.schoolId)
  },
}
