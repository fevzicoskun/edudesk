import { randomUUID } from 'crypto'
import type { GrantedPermission } from '@/src/domains/rbac/types'

function uid() { return randomUUID().slice(0, 8) }

// ── Profil / Auth sabitleri ───────────────────────────────────

export type MockRole = 'ogretmen' | 'zumre_baskani' | 'mudur_yardimcisi' | 'mudur'

export function makeProfile(role: MockRole, schoolId = 'school-test-1') {
  return {
    full_name: `Test ${role} ${uid()}`,
    subject:   'Matematik',
    role,
    school_id: schoolId,
    schools:   { name: 'Test Okul' },
  } as const
}

export function makeUser(schoolId = 'school-test-1') {
  return {
    id:    `user-${uid()}`,
    email: `test_${uid()}@test.example`,
    app_metadata:  {},
    user_metadata: {},
    aud:           'authenticated',
    created_at:    new Date().toISOString(),
  } as const
}

// ── Test veri fabrikaları ─────────────────────────────────────

export function makeHomework(overrides: Record<string, unknown> = {}) {
  return {
    title:       `Test Ödev ${uid()}`,
    subject:     'Matematik',
    due_date:    '2026-12-31',
    description: null,
    ...overrides,
  }
}

export function makeClass(schoolId: string) {
  return {
    name:          `Test Sınıf ${uid()}`,
    grade:         5,
    academic_year: '2025-2026',
    school_id:     schoolId,
  }
}

export function makeStudent(classId: string, schoolId: string) {
  return {
    full_name:      `Test Öğrenci ${uid()}`,
    student_number: null,
    class_id:       classId,
    school_id:      schoolId,
  }
}

// ── RBAC permission sabitleri ─────────────────────────────────

/** Öğretmen için minimum izin seti */
export const OGRETMEN_PERMS: GrantedPermission[] = [
  { resource: 'homework',   action: 'create', scope: 'own',    source: 'role' },
  { resource: 'homework',   action: 'read',   scope: 'school', source: 'role' },
  { resource: 'homework',   action: 'update', scope: 'own',    source: 'role' },
  { resource: 'homework',   action: 'delete', scope: 'own',    source: 'role' },
  { resource: 'attendance', action: 'create', scope: 'own',    source: 'role' },
  { resource: 'attendance', action: 'read',   scope: 'own',    source: 'role' },
  { resource: 'attendance', action: 'update', scope: 'own',    source: 'role' },
  { resource: 'students',   action: 'read',   scope: 'school', source: 'role' },
  { resource: 'classes',    action: 'read',   scope: 'school', source: 'role' },
  { resource: 'export',     action: 'create', scope: 'own',    source: 'role' },
  { resource: 'notes',      action: 'create', scope: 'own',    source: 'role' },
  { resource: 'notes',      action: 'read',   scope: 'own',    source: 'role' },
]

/** Müdür için tam izin seti (temsili — gerçek DB'den farklı olabilir) */
export const MUDUR_PERMS: GrantedPermission[] = [
  ...OGRETMEN_PERMS,
  { resource: 'users',  action: 'create', scope: 'school', source: 'role' },
  { resource: 'users',  action: 'read',   scope: 'school', source: 'role' },
  { resource: 'users',  action: 'update', scope: 'school', source: 'role' },
  { resource: 'users',  action: 'delete', scope: 'school', source: 'role' },
  { resource: 'users',  action: 'manage', scope: 'school', source: 'role' },
  { resource: 'school', action: 'read',   scope: 'school', source: 'role' },
  { resource: 'school', action: 'update', scope: 'school', source: 'role' },
  { resource: 'school', action: 'manage', scope: 'school', source: 'role' },
]

export const MUDUR_YARDIMCISI_PERMS: GrantedPermission[] = [
  ...OGRETMEN_PERMS,
  { resource: 'users',  action: 'create', scope: 'school', source: 'role' },
  { resource: 'users',  action: 'read',   scope: 'school', source: 'role' },
  { resource: 'users',  action: 'update', scope: 'school', source: 'role' },
  { resource: 'users',  action: 'delete', scope: 'school', source: 'role' },
  { resource: 'school', action: 'read',   scope: 'school', source: 'role' },
]
