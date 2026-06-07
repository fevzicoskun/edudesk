export {
  ClassRepository as default,
  ClassRepository,
} from '@/src/domains/classes/repositories/ClassRepository'

// Bireysel fonksiyon re-exportları — test mock'ları için
export const insertClass              = (...a: Parameters<typeof import('@/src/domains/classes/repositories/ClassRepository').ClassRepository.insertClass>) =>
  import('@/src/domains/classes/repositories/ClassRepository').then(m => m.ClassRepository.insertClass(...a))
export const softDeleteClass          = (...a: Parameters<typeof import('@/src/domains/classes/repositories/ClassRepository').ClassRepository.softDeleteClass>) =>
  import('@/src/domains/classes/repositories/ClassRepository').then(m => m.ClassRepository.softDeleteClass(...a))
export const restoreClass             = (...a: Parameters<typeof import('@/src/domains/classes/repositories/ClassRepository').ClassRepository.restoreClass>) =>
  import('@/src/domains/classes/repositories/ClassRepository').then(m => m.ClassRepository.restoreClass(...a))
export const softDeleteHomeworksByClass = (...a: Parameters<typeof import('@/src/domains/classes/repositories/ClassRepository').ClassRepository.softDeleteHomeworksByClass>) =>
  import('@/src/domains/classes/repositories/ClassRepository').then(m => m.ClassRepository.softDeleteHomeworksByClass(...a))
export const restoreHomeworksByClass  = (...a: Parameters<typeof import('@/src/domains/classes/repositories/ClassRepository').ClassRepository.restoreHomeworksByClass>) =>
  import('@/src/domains/classes/repositories/ClassRepository').then(m => m.ClassRepository.restoreHomeworksByClass(...a))
export const softDeleteStudentsByClass = (...a: Parameters<typeof import('@/src/domains/classes/repositories/ClassRepository').ClassRepository.softDeleteStudentsByClass>) =>
  import('@/src/domains/classes/repositories/ClassRepository').then(m => m.ClassRepository.softDeleteStudentsByClass(...a))
export const restoreStudentsByClass   = (...a: Parameters<typeof import('@/src/domains/classes/repositories/ClassRepository').ClassRepository.restoreStudentsByClass>) =>
  import('@/src/domains/classes/repositories/ClassRepository').then(m => m.ClassRepository.restoreStudentsByClass(...a))
export const softDeleteStudent        = (...a: Parameters<typeof import('@/src/domains/classes/repositories/ClassRepository').ClassRepository.softDeleteStudent>) =>
  import('@/src/domains/classes/repositories/ClassRepository').then(m => m.ClassRepository.softDeleteStudent(...a))
export const restoreStudent           = (...a: Parameters<typeof import('@/src/domains/classes/repositories/ClassRepository').ClassRepository.restoreStudent>) =>
  import('@/src/domains/classes/repositories/ClassRepository').then(m => m.ClassRepository.restoreStudent(...a))
export const insertStudent            = (...a: Parameters<typeof import('@/src/domains/classes/repositories/ClassRepository').ClassRepository.insertStudent>) =>
  import('@/src/domains/classes/repositories/ClassRepository').then(m => m.ClassRepository.insertStudent(...a))
export const insertStudents           = (...a: Parameters<typeof import('@/src/domains/classes/repositories/ClassRepository').ClassRepository.insertStudents>) =>
  import('@/src/domains/classes/repositories/ClassRepository').then(m => m.ClassRepository.insertStudents(...a))
export const deleteStudentNote        = (...a: Parameters<typeof import('@/src/domains/classes/repositories/ClassRepository').ClassRepository.deleteStudentNote>) =>
  import('@/src/domains/classes/repositories/ClassRepository').then(m => m.ClassRepository.deleteStudentNote(...a))
export const insertStudentNote        = (...a: Parameters<typeof import('@/src/domains/classes/repositories/ClassRepository').ClassRepository.insertStudentNote>) =>
  import('@/src/domains/classes/repositories/ClassRepository').then(m => m.ClassRepository.insertStudentNote(...a))
export const findClassInSchool        = (...a: Parameters<typeof import('@/src/domains/classes/repositories/ClassRepository').ClassRepository.findClassInSchool>) =>
  import('@/src/domains/classes/repositories/ClassRepository').then(m => m.ClassRepository.findClassInSchool(...a))
export const findStudentInSchool      = (...a: Parameters<typeof import('@/src/domains/classes/repositories/ClassRepository').ClassRepository.findStudentInSchool>) =>
  import('@/src/domains/classes/repositories/ClassRepository').then(m => m.ClassRepository.findStudentInSchool(...a))
