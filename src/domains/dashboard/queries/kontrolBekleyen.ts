import { cache } from 'react'
import { createClient } from '@/src/infrastructure/supabase/server'
import { logger } from '@/src/infrastructure/observability/logger'
import { fetchAllResult } from '@/src/shared/utils/fetchAll'
import { todayLocalISO, addDaysISO } from '@/src/shared/date'
import { kontrolBekleyenOzet, KONTROL_UYARI_GUNU, KONTROL_UYARI_PENCERE } from '@/src/domains/dashboard/lib/kontrolBekleyen'

type Satir = { teacher_id: string; due_date: string | null; assigned_date: string; homework_submissions: { count: number }[] }

/** Hata olursa boş döner: bu uyarı yüzünden Erken Uyarılar kutusunun tamamı düşmesin */
export const getKontrolBekleyen = cache(async (schoolId: string) => {
  const db = await createClient()
  const bugun = todayLocalISO()
  const ust = addDaysISO(bugun, -KONTROL_UYARI_GUNU)
  const alt = addDaysISO(bugun, -KONTROL_UYARI_PENCERE)
  const res = await fetchAllResult<Satir>((f, t) => db
    .from('homeworks')
    // count yalnız işaretli teslimleri sayar (embedded filtre) — otomatik açılan boş satırlar kontrol değildir
    .select('teacher_id, due_date, assigned_date, homework_submissions(count)')
    .not('homework_submissions.marked_at', 'is', null)
    .eq('school_id', schoolId).is('deleted_at', null).eq('is_template', false)
    // referans = due_date ?? assigned_date, pencerede; kesin eşik JS'te
    .or(`and(due_date.gte.${alt},due_date.lt.${ust}),and(due_date.is.null,assigned_date.gte.${alt},assigned_date.lt.${ust})`)
    .order('id').range(f, t))
  if (res.error) {
    logger.error({ event: 'db_query_failed', query: 'getKontrolBekleyen', school_id: schoolId, message: res.error.message }, 'Kontrol bekleyen ödev sorgusu başarısız')
    return []
  }
  const ozet = kontrolBekleyenOzet(
    res.data.map(r => ({ teacher_id: r.teacher_id, referans: r.due_date ?? r.assigned_date, isaretli: r.homework_submissions[0]?.count ?? 0 })),
    bugun,
  )
  if (ozet.length === 0) return []
  const { data: adlar } = await db.from('profiles').select('id, full_name').in('id', ozet.map(o => o.id))
  const ad = new Map((adlar ?? []).map(p => [p.id, p.full_name]))
  return ozet.map(o => ({ ...o, ad: ad.get(o.id) ?? '—' }))
})
