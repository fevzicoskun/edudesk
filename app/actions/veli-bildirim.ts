'use server'

import { UUID } from '@/src/shared/validation'
import { getAbility } from '@/src/shared/authorization/server'
import { P } from '@/src/shared/permissions'
import { createClient } from '@/src/infrastructure/supabase/server'
import { mailer } from '@/src/lib/mailer'
import { formatDateTR, buildReminderEmail } from '@/src/lib/email-utils'
import type { ActionResult } from '@/src/shared/types'

const MAX_RECIPIENTS = 100

export async function sendHomeworkReminderEmails(
  homeworkId: string,
  studentIds: string[]
): Promise<ActionResult<{ sent?: number; failed?: number }>> {
  const hwParse = UUID.safeParse(homeworkId)
  if (!hwParse.success) return { error: 'Geçersiz istek' }
  if (studentIds.some(id => !UUID.safeParse(id).success)) return { error: 'Geçersiz istek' }
  if (studentIds.length > MAX_RECIPIENTS) return { error: `Toplu e-posta en fazla ${MAX_RECIPIENTS} öğrenci için gönderilebilir` }

  const ability = await getAbility()
  if (!ability) return { error: 'Giriş gerekli' }
  if (ability.cannot(P.HOMEWORK.UPDATE)) return { error: 'Bu işlem için yetkiniz yok.' }

  if (studentIds.length === 0) return { sent: 0 }

  const supabase = await createClient()

  const { data: hw } = await supabase
    .from('homeworks')
    .select('teacher_id, title, due_date, school_id')
    .eq('id', homeworkId)
    .eq('school_id', ability.schoolId)
    .is('deleted_at', null)
    .single()

  if (!hw) return { error: 'Ödev bulunamadı' }

  const isManager = ability.scope(P.HOMEWORK.UPDATE) === 'school'
  if (!isManager && hw.teacher_id !== ability.userId) {
    return { error: 'Bu ödev için yetkiniz yok' }
  }

  const { data: students } = await supabase
    .from('students')
    .select('id, full_name, veli_email, veli_ad')
    .in('id', studentIds)
    .eq('school_id', ability.schoolId)
    .not('veli_email', 'is', null)
    .eq('veli_email_opt_out', false)

  const targets = (students ?? []).filter(s => s.veli_email)
  if (targets.length === 0) return { sent: 0 }

  const dueDateStr = hw.due_date ? formatDateTR(hw.due_date) : ''

  const results = await Promise.allSettled(
    targets.map(s =>
      mailer.sendMail({
        to: s.veli_email!,
        subject: `Ödev Hatırlatması — ${s.full_name}`,
        html: buildReminderEmail({
          veliAd:     s.veli_ad ?? 'Sayın Veli',
          ogrenciAdi: s.full_name,
          odevBaslik: hw.title,
          dueDateStr,
        }),
      })
    )
  )

  const sent   = results.filter(r => r.status === 'fulfilled').length
  const failed = results.filter(r => r.status === 'rejected').length

  return { sent, failed: failed > 0 ? failed : undefined }
}
