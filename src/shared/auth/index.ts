import { cache } from 'react'
import { createClient } from '@/src/infrastructure/supabase/server'
import type { Profile } from '@/src/shared/types'
import type { Resource, Action, GrantedPermission } from '@/src/domains/rbac/types'

export const getCurrentUser = cache(async () => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
})

export const getCurrentProfile = cache(async () => {
  const user = await getCurrentUser()
  if (!user) return null
  const supabase = await createClient()
  const { data } = await supabase
    .from('profiles')
    .select('full_name, subject, role, school_id, schools(name)')
    .eq('id', user.id)
    .single()
  return data as Pick<Profile, 'full_name' | 'subject' | 'role'> & {
    school_id: string
    schools: { name: string } | null
  } | null
})

export async function requireSchoolId(): Promise<string> {
  const profile = await getCurrentProfile()
  if (!profile?.school_id) throw new Error('Okul bilgisi bulunamadı')
  return profile.school_id
}

export const getCurrentPermissions = cache(async (): Promise<GrantedPermission[]> => {
  const [user, profile] = await Promise.all([getCurrentUser(), getCurrentProfile()])
  if (!user || !profile?.school_id) return []
  const { PermissionService } = await import('@/src/domains/rbac/services/PermissionService')
  return PermissionService.load(user.id, profile.school_id)
})

export async function requirePermission(resource: Resource, action: Action): Promise<void> {
  const [user, profile] = await Promise.all([getCurrentUser(), getCurrentProfile()])
  if (!user || !profile?.school_id) throw new Error('Giriş gerekli')
  const { PermissionService } = await import('@/src/domains/rbac/services/PermissionService')
  const allowed = await PermissionService.check(user.id, profile.school_id, resource, action)
  if (!allowed) throw new Error(`Yetki yok: ${resource}:${action}`)
}
