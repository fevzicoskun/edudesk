import { describe, it, expect } from 'vitest'
import {
  portalWeekStarts, nextWeekStart, groupPortalWeeks, toPlanStatus,
  planVeliJti, planVeliJtiPrefix, selectPlanNotifyTargets, buildPlanHazirEmail,
  type VeliPlanItem, type NotifyItemRow,
} from '@/src/domains/studyPlan/veliPlanMath'

// 2026-09-10 Perşembe → bu hafta 07.09, gelecek hafta 14.09
const TODAY = '2026-09-10'

function item(p: Partial<VeliPlanItem> & { id: string; week_start: string }): VeliPlanItem {
  return { subject: 'Matematik', plan_date: null, source: null, description: 'Türev 40 soru', status: 'planlandi', note: null, ...p }
}

describe('hafta hesabı', () => {
  it('portalWeekStarts: bu hafta + gelecek hafta Pazartesileri', () => {
    expect(portalWeekStarts(TODAY)).toEqual(['2026-09-07', '2026-09-14'])
  })
  it('Pazar günü hâlâ içinde bulunulan haftadır (TR hafta Pazartesi başlar)', () => {
    expect(portalWeekStarts('2026-09-13')).toEqual(['2026-09-07', '2026-09-14'])
  })
  it('nextWeekStart: Pazar 18:00 cron → ertesi gün Pazartesi', () => {
    expect(nextWeekStart('2026-09-13')).toBe('2026-09-14')
  })
  it('nextWeekStart: yıl geçişi', () => {
    expect(nextWeekStart('2026-12-31')).toBe('2027-01-04')
  })
})

describe('toPlanStatus', () => {
  it('bilinen değerleri korur', () => {
    expect(toPlanStatus('yapildi')).toBe('yapildi')
    expect(toPlanStatus('eksik')).toBe('eksik')
    expect(toPlanStatus('yapilmadi')).toBe('yapilmadi')
  })
  it('bilinmeyen değer → planlandi (fail-safe)', () => {
    expect(toPlanStatus('hack')).toBe('planlandi')
  })
})

describe('groupPortalWeeks', () => {
  it('plan yoksa boş dizi (bölüm render edilmez)', () => {
    expect(groupPortalWeeks([], TODAY)).toEqual([])
  })
  it('yalnız bu hafta varsa tek grup; gelecek hafta grubu üretilmez', () => {
    const r = groupPortalWeeks([item({ id: 'a', week_start: '2026-09-07' })], TODAY)
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ weekStart: '2026-09-07', baslik: 'Bu Hafta', aralik: '7 – 13 Eylül 2026' })
  })
  it('bu hafta + gelecek hafta sırayla; özet sayıları hafta bazlı', () => {
    const r = groupPortalWeeks([
      item({ id: 'n1', week_start: '2026-09-14' }),
      item({ id: 'b1', week_start: '2026-09-07', status: 'yapildi' }),
      item({ id: 'b2', week_start: '2026-09-07', status: 'eksik' }),
    ], TODAY)
    expect(r.map(w => w.baslik)).toEqual(['Bu Hafta', 'Gelecek Hafta'])
    expect(r[0].ozet).toMatchObject({ toplam: 2, yapildi: 1, eksik: 1 })
    expect(r[1].items.map(i => i.id)).toEqual(['n1'])
  })
  it('pencere dışındaki haftaları (geçmiş/2 hafta sonrası) yok sayar', () => {
    const r = groupPortalWeeks([
      item({ id: 'eski', week_start: '2026-08-31' }),
      item({ id: 'uzak', week_start: '2026-09-21' }),
    ], TODAY)
    expect(r).toEqual([])
  })
  it('hafta içinde: gün-bağımsız ("Hafta") maddeler önce, sonra tarih sırası (v1 ile aynı)', () => {
    const r = groupPortalWeeks([
      item({ id: 'cum', week_start: '2026-09-07', plan_date: '2026-09-11' }),
      item({ id: 'pzt', week_start: '2026-09-07', plan_date: '2026-09-07' }),
      item({ id: 'genel', week_start: '2026-09-07', plan_date: null }),
    ], TODAY)
    expect(r[0].items.map(i => i.id)).toEqual(['genel', 'pzt', 'cum'])
  })
})

describe('planVeliJti', () => {
  it('hafta + öğrenci ile deterministik; prefix haftayı kapsar', () => {
    expect(planVeliJti('2026-09-14', 'stu-1')).toBe('plan-2026-09-14-stu-1')
    expect(planVeliJti('2026-09-14', 'stu-1').startsWith(planVeliJtiPrefix('2026-09-14'))).toBe(true)
    expect(planVeliJti('2026-09-21', 'stu-1').startsWith(planVeliJtiPrefix('2026-09-14'))).toBe(false)
  })
})

describe('selectPlanNotifyTargets', () => {
  const veli = { full_name: 'Ayşe Yılmaz', veli_email: 'veli@test.com', veli_ad: 'Fatma Yılmaz', veli_email_opt_out: false, deleted_at: null }
  const row = (p: Partial<NotifyItemRow>): NotifyItemRow => ({ student_id: 'stu-1', school_id: 'sch-1', teacher_id: 't-1', students: veli, ...p })

  it('öğrenci başına TEK hedef (çok madde → tek mesaj); ilk maddenin öğretmeni link sahibi', () => {
    const r = selectPlanNotifyTargets([row({ teacher_id: 't-1' }), row({ teacher_id: 't-2' }), row({ teacher_id: 't-1' })], new Set())
    expect(r).toEqual([{ studentId: 'stu-1', schoolId: 'sch-1', teacherId: 't-1', to: 'veli@test.com', veliAd: 'Fatma Yılmaz', ogrenciAdi: 'Ayşe Yılmaz' }])
  })
  it('birden çok öğrenci ilk görülme sırasıyla', () => {
    const r = selectPlanNotifyTargets([row({ student_id: 'stu-2' }), row({ student_id: 'stu-1' })], new Set())
    expect(r.map(t => t.studentId)).toEqual(['stu-2', 'stu-1'])
  })
  it('bu hafta için zaten bildirilmiş öğrenci atlanır (dedup)', () => {
    expect(selectPlanNotifyTargets([row({})], new Set(['stu-1']))).toEqual([])
  })
  it('veli e-postası yok / boş / opt-out → atlanır', () => {
    expect(selectPlanNotifyTargets([row({ students: { ...veli, veli_email: null } })], new Set())).toEqual([])
    expect(selectPlanNotifyTargets([row({ students: { ...veli, veli_email: '  ' } })], new Set())).toEqual([])
    expect(selectPlanNotifyTargets([row({ students: { ...veli, veli_email_opt_out: true } })], new Set())).toEqual([])
  })
  it('silinmiş öğrenci veya ilişki null → atlanır', () => {
    expect(selectPlanNotifyTargets([row({ students: { ...veli, deleted_at: '2026-09-01T00:00:00Z' } })], new Set())).toEqual([])
    expect(selectPlanNotifyTargets([row({ students: null })], new Set())).toEqual([])
  })
})

describe('buildPlanHazirEmail', () => {
  const base = {
    veliAd: 'Fatma Yılmaz', ogrenciAdi: 'Ayşe Yılmaz', weekStart: '2026-09-14',
    portalUrl: 'https://myedudesk.com.tr/veli/v1.abc.def', unsubscribeUrl: 'https://myedudesk.com.tr/api/unsubscribe?id=stu-1&sig=x',
  }
  it('konu: "Haftaya çalışma planı hazır" + öğrenci adı', () => {
    expect(buildPlanHazirEmail(base).subject).toBe('Haftaya çalışma planı hazır — Ayşe Yılmaz')
  })
  it('gövde: hafta aralığı, portal linki ve abonelikten çıkma linki', () => {
    const { html } = buildPlanHazirEmail(base)
    expect(html).toContain('14 – 20 Eylül 2026')
    expect(html).toContain('href="https://myedudesk.com.tr/veli/v1.abc.def"')
    expect(html).toContain('/api/unsubscribe?id=stu-1&amp;sig=x')
  })
  it('veli adı yoksa "Sayın Veli"', () => {
    expect(buildPlanHazirEmail({ ...base, veliAd: null }).html).toContain('Sayın Veli')
  })
  it('isimleri HTML-escape eder (XSS)', () => {
    const { html } = buildPlanHazirEmail({ ...base, ogrenciAdi: '<script>x</script>' })
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })
})
