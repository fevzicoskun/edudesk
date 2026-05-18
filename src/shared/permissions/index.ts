import type { Resource, Action } from '@/src/domains/rbac/types'

export const P = {
  HOMEWORK: {
    CREATE: { resource: 'homework' as Resource, action: 'create' as Action },
    READ:   { resource: 'homework' as Resource, action: 'read'   as Action },
    UPDATE: { resource: 'homework' as Resource, action: 'update' as Action },
    DELETE: { resource: 'homework' as Resource, action: 'delete' as Action },
  },
  ATTENDANCE: {
    CREATE: { resource: 'attendance' as Resource, action: 'create' as Action },
    READ:   { resource: 'attendance' as Resource, action: 'read'   as Action },
    UPDATE: { resource: 'attendance' as Resource, action: 'update' as Action },
  },
  CURRICULUM: {
    CREATE: { resource: 'curriculum' as Resource, action: 'create' as Action },
    READ:   { resource: 'curriculum' as Resource, action: 'read'   as Action },
    UPDATE: { resource: 'curriculum' as Resource, action: 'update' as Action },
  },
  STUDENTS: {
    READ:   { resource: 'students' as Resource, action: 'read'   as Action },
    CREATE: { resource: 'students' as Resource, action: 'create' as Action },
    UPDATE: { resource: 'students' as Resource, action: 'update' as Action },
    DELETE: { resource: 'students' as Resource, action: 'delete' as Action },
  },
  CLASSES: {
    READ:   { resource: 'classes' as Resource, action: 'read'   as Action },
    CREATE: { resource: 'classes' as Resource, action: 'create' as Action },
    UPDATE: { resource: 'classes' as Resource, action: 'update' as Action },
    DELETE: { resource: 'classes' as Resource, action: 'delete' as Action },
  },
  ZUMRE: {
    CREATE: { resource: 'zumre' as Resource, action: 'create' as Action },
    READ:   { resource: 'zumre' as Resource, action: 'read'   as Action },
    UPDATE: { resource: 'zumre' as Resource, action: 'update' as Action },
    DELETE: { resource: 'zumre' as Resource, action: 'delete' as Action },
    MANAGE: { resource: 'zumre' as Resource, action: 'manage' as Action },
  },
  EXAM: {
    CREATE: { resource: 'exam' as Resource, action: 'create' as Action },
    READ:   { resource: 'exam' as Resource, action: 'read'   as Action },
    UPDATE: { resource: 'exam' as Resource, action: 'update' as Action },
    DELETE: { resource: 'exam' as Resource, action: 'delete' as Action },
    MANAGE: { resource: 'exam' as Resource, action: 'manage' as Action },
  },
  USERS: {
    CREATE: { resource: 'users' as Resource, action: 'create' as Action },
    READ:   { resource: 'users' as Resource, action: 'read'   as Action },
    UPDATE: { resource: 'users' as Resource, action: 'update' as Action },
    DELETE: { resource: 'users' as Resource, action: 'delete' as Action },
    MANAGE: { resource: 'users' as Resource, action: 'manage' as Action },
  },
  SCHOOL: {
    READ:   { resource: 'school' as Resource, action: 'read'   as Action },
    UPDATE: { resource: 'school' as Resource, action: 'update' as Action },
    MANAGE: { resource: 'school' as Resource, action: 'manage' as Action },
  },
  EXPORT: {
    CREATE: { resource: 'export' as Resource, action: 'create' as Action },
  },
  NOTES: {
    CREATE: { resource: 'notes' as Resource, action: 'create' as Action },
    READ:   { resource: 'notes' as Resource, action: 'read'   as Action },
    UPDATE: { resource: 'notes' as Resource, action: 'update' as Action },
    DELETE: { resource: 'notes' as Resource, action: 'delete' as Action },
  },
} as const
