/**
 * Type-safe permission sabitleri.
 *
 * Her sabit { resource, action } çiftini literal type olarak tutar.
 * Eski: { resource: 'homework' as Resource, action: 'create' as Action }
 * Yeni: { resource: 'homework', action: 'create' }  — tam çıkarım, no cast
 *
 * Kullanım:
 *   import { P } from '@/src/shared/permissions'
 *   ability.can(P.HOMEWORK.CREATE)
 *   guard(ability, P.CLASSES.DELETE)
 *   withPermission(P.USERS.CREATE, handler)
 */

import type { Resource, Action } from '@/src/domains/rbac/types'
import type { PermissionKey } from '@/src/shared/authorization'

/**
 * İki string'i compile-time'da Resource ve Action olarak doğrulayan helper.
 * Magic string'lere karşı tam koruma — geçersiz değer derleme hatası verir.
 */
function p<R extends Resource, A extends Action>(
  resource: R,
  action:   A,
): PermissionKey & { readonly resource: R; readonly action: A } {
  return { resource, action }
}

export const P = {
  HOMEWORK: {
    CREATE: p('homework', 'create'),
    READ:   p('homework', 'read'),
    UPDATE: p('homework', 'update'),
    DELETE: p('homework', 'delete'),
  },
  ATTENDANCE: {
    CREATE: p('attendance', 'create'),
    READ:   p('attendance', 'read'),
    UPDATE: p('attendance', 'update'),
  },
  STUDENTS: {
    READ:   p('students', 'read'),
    CREATE: p('students', 'create'),
    UPDATE: p('students', 'update'),
    DELETE: p('students', 'delete'),
  },
  CLASSES: {
    READ:   p('classes', 'read'),
    CREATE: p('classes', 'create'),
    UPDATE: p('classes', 'update'),
    DELETE: p('classes', 'delete'),
  },
  ZUMRE: {
    CREATE: p('zumre', 'create'),
    READ:   p('zumre', 'read'),
    UPDATE: p('zumre', 'update'),
    DELETE: p('zumre', 'delete'),
    MANAGE: p('zumre', 'manage'),
  },
  EXAM: {
    CREATE: p('exam', 'create'),
    READ:   p('exam', 'read'),
    UPDATE: p('exam', 'update'),
    DELETE: p('exam', 'delete'),
    MANAGE: p('exam', 'manage'),
  },
  USERS: {
    CREATE: p('users', 'create'),
    READ:   p('users', 'read'),
    UPDATE: p('users', 'update'),
    DELETE: p('users', 'delete'),
    MANAGE: p('users', 'manage'),
  },
  SCHOOL: {
    READ:   p('school', 'read'),
    UPDATE: p('school', 'update'),
    MANAGE: p('school', 'manage'),
  },
  EXPORT: {
    CREATE: p('export', 'create'),
  },
  NOTES: {
    CREATE: p('notes', 'create'),
    READ:   p('notes', 'read'),
    UPDATE: p('notes', 'update'),
    DELETE: p('notes', 'delete'),
  },
  GRADES: {
    CREATE: p('grades', 'create'),
    READ:   p('grades', 'read'),
    UPDATE: p('grades', 'update'),
    DELETE: p('grades', 'delete'),
  },
  KANAAT: {
    CREATE: p('kanaat', 'create'),
    READ:   p('kanaat', 'read'),
    UPDATE: p('kanaat', 'update'),
  },
} as const

export type { PermissionKey }
