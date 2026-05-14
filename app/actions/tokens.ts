'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'
import { createPublicToken } from '@/lib/public-tokens'
import { UUID } from '@/lib/validation'
import { logAudit } from '@/lib/audit'

/** Öğrenci için 7 günlük veli portalı linki oluştur */
export async function generateVeliToken(studentId: string): Promise<string> {
  UUID.parse(studentId)
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  // Öğrencinin var olduğunu doğrula
  const supabase = await createClient()
  const { data: student } = await supabase
    .from('students')
    .select('id, full_name')
    .eq('id', studentId)
    .single()
  if (!student) throw new Error('Öğrenci bulunamadı')

  const token = await createPublicToken('veli', studentId, 7)

  await logAudit({
    user_id: user.id,
    action: 'student.create',
    table_name: 'students',
    record_id: studentId,
    new_data: { action: 'veli_token_generated', student_name: student.full_name },
  })

  return token
}

/** Yoklama yazdırma linki oluştur (1 günlük) */
export async function generateYoklamaToken(classId: string, date: string): Promise<string> {
  UUID.parse(classId)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Geçersiz tarih')

  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const token = await createPublicToken('yoklama', classId, 1, { date })
  return token
}

/** Tutanak yazdırma linki oluştur (7 günlük) */
export async function generateTutanakToken(meetingId: string): Promise<string> {
  UUID.parse(meetingId)
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const token = await createPublicToken('tutanak', meetingId, 7)
  return token
}
