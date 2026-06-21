'use server'

import { getCurrentProfile } from '@/src/shared/auth'
import { isMudurOrAbove } from '@/src/shared/types'
import { donemBasi } from '@/src/shared/utils'
import { getSchoolTeachers } from '@/src/domains/dashboard/queries/schoolStats'
import {
  getAttendanceTrendRows, getHomeworkTrendRows, getTrendClasses,
} from '@/src/domains/dashboard/queries/schoolTrends'
import {
  computeAbsenceTrend, computeActivityTrend, computeCoverageTrend, computeClassAbsence,
} from '@/src/domains/dashboard/lib/trendMath'
import { buildKarneData, type KarneData } from '@/src/domains/dashboard/lib/karne'

export async function getOkulKarnesi(): Promise<KarneData> {
  const profile = await getCurrentProfile()
  if (!profile?.school_id || !isMudurOrAbove(profile.role)) {
    throw new Error('Bu rapora erişim yetkiniz yok')
  }
  const schoolId = profile.school_id
  const schoolName = profile.schools?.name ?? 'Okul'
  const donemStart = donemBasi()
  const now = new Date()

  const [attRows, hwRows, classes, teachers] = await Promise.all([
    getAttendanceTrendRows(schoolId, donemStart),
    getHomeworkTrendRows(schoolId, donemStart),
    getTrendClasses(schoolId),
    getSchoolTeachers(schoolId),
  ])

  const absence  = computeAbsenceTrend(attRows, donemStart, now)
  const activity = computeActivityTrend(attRows, hwRows, teachers.length, donemStart, now)
  const coverage = computeCoverageTrend(attRows, classes.length, donemStart, now)
  const classAbs = computeClassAbsence(attRows, classes)

  return buildKarneData(schoolName, donemStart, absence, activity, coverage, classAbs, now)
}
