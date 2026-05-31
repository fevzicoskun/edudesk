import { getAbility } from '@/src/shared/authorization/server'
import { P } from '@/src/shared/permissions'
import { createClient } from '@/src/infrastructure/supabase/server'
import { KanaatRepository } from '../repositories/KanaatRepository'
import { computeKanaat, generateKanaatText } from '../lib/computeKanaat'
import type { KanaatNotu, KanaatHesap } from '../types'

interface KayitInput {
  studentId: string
  score:     1 | 2 | 3 | 4 | 5
  text:      string
}

export const KanaatService = {
  async getKanaatKayitlari(
    classId: string,
    donem:   string,
  ): Promise<{ data?: KanaatNotu[]; error?: string }> {
    const ability = await getAbility()
    if (!ability) return { error: 'Giriş gerekli' }
    if (ability.cannot(P.KANAAT.READ)) return { error: 'Bu işlem için yetkiniz yok.' }

    const { data, error } = await KanaatRepository.findByClassAndDonem(classId, donem, ability.schoolId)
    if (error) return { error: error.message }
    return { data: (data ?? []) as KanaatNotu[] }
  },

  async saveKanaatKayitlari(
    classId:  string,
    donem:    string,
    kayitlar: KayitInput[],
  ): Promise<{ error?: string }> {
    const ability = await getAbility()
    if (!ability) return { error: 'Giriş gerekli' }
    if (ability.cannot(P.KANAAT.CREATE)) return { error: 'Bu işlem için yetkiniz yok.' }

    const rows = kayitlar.map(k => ({
      student_id: k.studentId,
      class_id:   classId,
      teacher_id: ability.userId,
      school_id:  ability.schoolId,
      score:      k.score,
      text:       k.text,
      donem,
    }))

    const { error } = await KanaatRepository.upsertMany(rows)
    if (error) return { error: error.message }
    return {}
  },

  async generateKanaatHesap(
    classId: string,
    donem:   string,
  ): Promise<{ data?: KanaatHesap[]; error?: string }> {
    const ability = await getAbility()
    if (!ability) return { error: 'Giriş gerekli' }
    if (ability.cannot(P.KANAAT.CREATE)) return { error: 'Bu işlem için yetkiniz yok.' }

    const db = await createClient()

    // Öğrenciler
    const { data: students, error: stuErr } = await db
      .from('students')
      .select('id, full_name')
      .eq('class_id', classId)
      .eq('school_id', ability.schoolId)
      .is('deleted_at', null)

    if (stuErr) return { error: stuErr.message }
    if (!students?.length) return { data: [] }

    const studentIds = students.map(s => s.id)

    // Donem tarih aralığını hesapla
    const parts = donem.split('-')
    const startYear = parseInt(parts[0]!)
    const yarim = parts[2]!
    const donemStart = yarim === '1'
      ? `${startYear}-09-01`
      : `${startYear + 1}-01-15`
    const donemEnd = yarim === '1'
      ? `${startYear + 1}-01-14`
      : `${startYear + 1}-06-30`

    // Ödevler + teslimler
    const { data: homeworks } = await db
      .from('homeworks')
      .select('id')
      .eq('class_id', classId)
      .eq('school_id', ability.schoolId)
      .is('deleted_at', null)
      .gte('due_date', donemStart)
      .lte('due_date', donemEnd)

    const hwIds = (homeworks ?? []).map(h => h.id)
    const { data: submissions } = hwIds.length
      ? await db
          .from('homework_submissions')
          .select('student_id, status')
          .in('homework_id', hwIds)
          .in('student_id', studentIds)
      : { data: [] }

    // Devamsızlık
    const { data: attendance } = await db
      .from('attendance')
      .select('student_id, status')
      .in('student_id', studentIds)
      .eq('school_id', ability.schoolId)
      .eq('status', 'absent')
      .gte('date', donemStart)
      .lte('date', donemEnd)

    // Sınav notları
    const { data: gradeColumns } = await db
      .from('grade_columns')
      .select('id')
      .eq('class_id', classId)
      .eq('school_id', ability.schoolId)
      .gte('exam_date', donemStart)
      .lte('exam_date', donemEnd)

    const colIds = (gradeColumns ?? []).map(c => c.id)
    const { data: gradeEntries } = colIds.length
      ? await db
          .from('grade_entries')
          .select('student_id, score, grade_column_id')
          .in('grade_column_id', colIds)
          .in('student_id', studentIds)
      : { data: [] }

    // Öğrenci başına aggregation
    const totalHw = hwIds.length
    const submissionMap = new Map<string, number>()
    const absenceMap    = new Map<string, number>()
    const examMap       = new Map<string, number[]>()

    for (const s of submissions ?? []) {
      if (s.status === 'yapildi' || s.status === 'gec') {
        submissionMap.set(s.student_id, (submissionMap.get(s.student_id) ?? 0) + 1)
      }
    }
    for (const a of attendance ?? []) {
      absenceMap.set(a.student_id, (absenceMap.get(a.student_id) ?? 0) + 1)
    }
    for (const e of gradeEntries ?? []) {
      if (e.score !== null) {
        const arr = examMap.get(e.student_id) ?? []
        arr.push(e.score)
        examMap.set(e.student_id, arr)
      }
    }

    const hesaplar: KanaatHesap[] = students.map(student => {
      const done     = submissionMap.get(student.id) ?? 0
      const absences = absenceMap.get(student.id)    ?? 0
      const scores   = examMap.get(student.id)

      const examAverage = scores?.length
        ? scores.reduce((a, b) => a + b, 0) / scores.length
        : null

      const score = computeKanaat({
        homeworkTotal: totalHw,
        homeworkDone:  done,
        absenceDays:   absences,
        examAverage,
      })

      const homeworkPct = totalHw > 0 ? (done / totalHw) * 100 : 0

      const text = generateKanaatText(student.full_name, score, {
        homeworkPct,
        absenceDays: absences,
        examAverage,
      })

      return { studentId: student.id, studentName: student.full_name, score, text }
    })

    return { data: hesaplar }
  },
}
