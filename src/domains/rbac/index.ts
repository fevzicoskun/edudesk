export type {
  Resource, Action, Scope, AccessScope,
  Permission, Role, UserRole, GrantedPermission, PermissionRequirement,
} from './types'

export { PermissionService } from './services/PermissionService'
export { RbacRepository }    from './repositories/RbacRepository'

export {
  withPermission,
  withAnyPermission,
  checkPermission,
  type AuthContext,
} from './middleware/withPermission'

// Authorization engine — merkezi yetki motoru
export {
  createAbility,
  can,
  cannot,
  guard,
  guardAll,
  guardAny,
  AuthorizationError,
  type Ability,
  type AuthorizationContext,
  type PermissionKey,
  type DenialReason,
  type DenialCode,
  type AuthorizationResult,
} from '@/src/shared/authorization'
