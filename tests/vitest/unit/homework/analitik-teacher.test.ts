import { describe, it, expect } from 'vitest'
import { computeTeacherStats } from '@/src/domains/homework/lib/analitik'
import type { AnalitikHomework, AnalitikSubmission, AnalitikStudent } from '@/src/domains/homework/lib/analitik'

function hw(id: string, classId: string, teacherId: string): AnalitikHomework {
  return { id, class_id: classId, teacher_id: teacherId, due_date: '2026-05-01', title: `Ödev ${id}` }
}
function sub(homeworkId: string, studentId: string, status: AnalitikSubmission['status']): AnalitikSubmission {
  return { homework_id: homeworkId, student_id: studentId, status }
}
function student(id: string, classId: string): AnalitikStudent {
  return { id, class_id: classId, full_name: `Öğrenci ${id}`, student_number: id }
}
const teacher = (id: string) => ({ id, full_name: `Öğretmen ${id}` })

describe('computeTeacherStats()', () => {
  it('ödevi olmayan öğretmen sonuçta çıkmaz', () => {
    const result = computeTeacherStats([teacher('t1')], [], [], [])
    expect(result).toHaveLength(0)
  })

  it('tüm ödevler yapıldı → avgCompletionPct=100', () => {
    const homeworks = [hw('h1', 'c1', 't1'), hw('h2', 'c1', 't1')]
    const students  = [student('s1', 'c1'), student('s2', 'c1')]
    const subs = [
      sub('h1', 's1', 'yapildi'), sub('h1', 's2', 'yapildi'),
      sub('h2', 's1', 'yapildi'), sub('h2', 's2', 'yapildi'),
    ]
    const result = computeTeacherStats([teacher('t1')], homeworks, subs, students)
    expect(result[0].avgCompletionPct).toBe(100)
  })

  it('2 öğrenci 3+ ödev yapılmadı → riskyStudentCount=2', () => {
    const homeworks = [hw('h1','c1','t1'), hw('h2','c1','t1'), hw('h3','c1','t1')]
    const students  = [student('s1','c1'), student('s2','c1'), student('s3','c1')]
    const subs = [
      sub('h1','s1','yapilmadi'), sub('h2','s1','yapilmadi'), sub('h3','s1','yapilmadi'),
      sub('h1','s2','eksik'), sub('h2','s2','eksik'), sub('h3','s2','eksik'),
      sub('h1','s3','yapilmadi'), sub('h2','s3','yapilmadi'),
    ]
    const result = computeTeacherStats([teacher('t1')], homeworks, subs, students)
    expect(result[0].riskyStudentCount).toBe(2)
  })

  it('birden fazla öğretmen, ödev sayısına göre azalan sıra', () => {
    const homeworks = [
      hw('h1','c1','t1'), hw('h2','c1','t1'), hw('h3','c1','t1'),
      hw('h4','c2','t2'),
    ]
    const result = computeTeacherStats([teacher('t1'), teacher('t2')], homeworks, [], [])
    expect(result[0].teacher_id).toBe('t1')
    expect(result[1].teacher_id).toBe('t2')
  })

  it('mazeretli paydadan çıkar', () => {
    const homeworks = [hw('h1', 'c1', 't1')]
    const students  = [student('s1', 'c1'), student('s2', 'c1')]
    const subs = [sub('h1', 's1', 'yapildi'), sub('h1', 's2', 'mazeretli')]
    const result = computeTeacherStats([teacher('t1')], homeworks, subs, students)
    expect(result[0].avgCompletionPct).toBe(100)
  })
})
