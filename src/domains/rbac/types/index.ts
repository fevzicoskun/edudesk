export type Resource =
  | 'homework'
  | 'attendance'
  | 'students'
  | 'classes'
  | 'zumre'
  | 'exam'
  | 'users'
  | 'school'
  | 'export'
  | 'notes'
  | 'grades'
  | 'kanaat'

export type Action = 'create' | 'read' | 'update' | 'delete' | 'manage'

export type Scope = 'own' | 'school' | 'any'

/** DB'den gelen tek bir izin satırı */
export interface Permission {
  id: string
  resource: Resource
  action: Action
  scope: Scope
  description: string | null
}

/** DB'den gelen rol satırı */
export interface Role {
  id: string
  school_id: string | null
  name: string
  display_name: string
  is_system: boolean
  created_at: string
}

/** Kullanıcıya atanmış rol (user_roles JOIN roles) */
export interface UserRole {
  user_id: string
  role_id: string
  school_id: string | null
  granted_by: string | null
  granted_at: string
  expires_at: string | null
  role: Role
}

/** get_user_permissions() RPC'den dönen satır */
export interface GrantedPermission {
  resource: Resource
  action: Action
  scope: Scope
  source: 'role' | 'direct'
}

/** withPermission middleware için gereksinim tanımı */
export interface PermissionRequirement {
  resource: Resource
  action: Action
}

/** Kullanıcının bir kaynak üzerindeki erişim kapsamı */
export type AccessScope = 'school' | 'own' | null
