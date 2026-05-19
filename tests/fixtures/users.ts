import { randomUUID } from 'crypto'
import type { GrantedPermission } from '@/src/domains/rbac/types'
import { ROLE_PERMISSIONS, type MockRole } from './permissions'

function uid() { return randomUUID().slice(0, 8) }

export const SCHOOL_A = 'school-aaaa-0001'
export const SCHOOL_B = 'school-bbbb-0002'

export interface MockUser {
  id: string
  email: string
  role: MockRole
  school_id: string
  full_name: string
  permissions: GrantedPermission[]
}

export function makeUser(role: MockRole, schoolId = SCHOOL_A): MockUser {
  return {
    id:          `user-${role}-${uid()}`,
    email:       `${role}-${uid()}@test.example`,
    role,
    school_id:   schoolId,
    full_name:   `Test ${role}`,
    permissions: ROLE_PERMISSIONS[role],
  }
}

// Stable singleton users for snapshot / cross-test usage
export const USER_OGRETMEN_A          = makeUser('ogretmen',         SCHOOL_A)
export const USER_OGRETMEN_A2         = makeUser('ogretmen',         SCHOOL_A)  // second teacher, same school
export const USER_OGRETMEN_B          = makeUser('ogretmen',         SCHOOL_B)  // different school
export const USER_ZUMRE_BASKANI_A     = makeUser('zumre_baskani',    SCHOOL_A)
export const USER_MUDUR_YARDIMCISI_A  = makeUser('mudur_yardimcisi', SCHOOL_A)
export const USER_MUDUR_A             = makeUser('mudur',            SCHOOL_A)
