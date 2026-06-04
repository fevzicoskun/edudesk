'use server'

import { UUID } from '@/src/shared/validation'
import { getAbility } from '@/src/shared/authorization/server'
import { P } from '@/src/shared/permissions'
import { createClient } from '@/src/infrastructure/supabase/server'
import { mailer } from '@/src/lib/mailer'

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

export async function sendHomeworkReminderEmails(
  homeworkId: string,
  studentIds: string[]
): Promise<{ error?: string; sent?: number; failed?: number }> {
  UUID.parse(homeworkId)
  studentIds.forEach(id => UUID.parse(id))

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

  const dueDateStr = hw.due_date ?? ''

  const results = await Promise.allSettled(
    targets.map(s =>
      mailer.sendMail({
        to: s.veli_email!,
        subject: `Ödev Hatırlatması — ${s.full_name}`,
        html: `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>body{font-family:sans-serif;color:#1f2937;line-height:1.6}
.box{max-width:520px;margin:32px auto;padding:32px;border:1px solid #e5e7eb;border-radius:12px}
.badge{display:inline-block;background:#eff6ff;color:#1d4ed8;padding:4px 10px;border-radius:6px;font-size:13px;font-weight:600}
.footer{margin-top:24px;padding-top:16px;border-top:1px solid #f3f4f6;font-size:12px;color:#9ca3af}
</style></head>
<body><div class="box">
<p>${esc(s.veli_ad ?? 'Sayın Veli')},</p>
<p><strong>${esc(s.full_name)}</strong> adlı öğrencinizin</p>
<p class="badge">"${esc(hw.title)}"</p>
<p>adlı ödevi${dueDateStr ? ` <strong>${esc(dueDateStr)}</strong> tarihinde` : ''} teslim edilmesi gerekmektedir.</p>
<p>Lütfen ödevin tamamlandığından emin olunuz.</p>
<div class="footer">EduDesk — Okul Takip Sistemi</div>
</div></body></html>`,
      })
    )
  )

  const sent   = results.filter(r => r.status === 'fulfilled').length
  const failed = results.filter(r => r.status === 'rejected').length

  return { sent, failed: failed > 0 ? failed : undefined }
}
