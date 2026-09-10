import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/src/infrastructure/observability/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }))
vi.mock('@/src/infrastructure/tokens', () => ({
  createPublicToken: vi.fn(async (_t: string, _id: string, _ttl: number, _m: unknown, jti: string) => `v1.tok-${jti}`),
}))
vi.mock('@/src/lib/mailer', () => ({ mailer: { sendMail: vi.fn() } }))
vi.mock('@/src/lib/unsubscribeToken', () => ({
  unsubscribeUrl: vi.fn((id: string, base: string) => `${base}/api/unsubscribe?id=${id}&sig=s`),
}))
vi.mock('@/src/domains/studyPlan/repositories/VeliPlanRepository', () => ({
  VeliPlanRepository: {
    listPortalItems:       vi.fn(),
    listWeekItemsPage:     vi.fn(),
    listNotifiedPage:      vi.fn(),
    insertVeliTokens:      vi.fn(),
  },
}))

const { logger }             = await import('@/src/infrastructure/observability/logger')
const { createPublicToken }  = await import('@/src/infrastructure/tokens')
const { mailer }             = await import('@/src/lib/mailer')
const { VeliPlanRepository } = await import('@/src/domains/studyPlan/repositories/VeliPlanRepository')
const { VeliPlanService }    = await import('@/src/domains/studyPlan/services/VeliPlanService')

const WEEK = '2026-09-14', BASE = 'https://app.test'
const veli = (p: Record<string, unknown> = {}) => ({ full_name: 'Ayşe Yılmaz', veli_email: 'veli@test.com', veli_ad: 'Fatma', veli_email_opt_out: false, deleted_at: null, ...p })
const row = (p: Record<string, unknown> = {}) => ({ student_id: 'stu-1', school_id: 'sch-1', teacher_id: 't-1', students: veli(), ...p })

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(VeliPlanRepository.listWeekItemsPage).mockResolvedValue({ data: [], error: null } as never)
  vi.mocked(VeliPlanRepository.listNotifiedPage).mockResolvedValue({ data: [], error: null } as never)
  vi.mocked(VeliPlanRepository.insertVeliTokens).mockResolvedValue({ error: null } as never)
  vi.mocked(mailer.sendMail).mockResolvedValue(undefined)
})

describe('VeliPlanService.getPortalWeeks', () => {
  it('bu hafta + gelecek hafta penceresini okul filtresiyle ister ve gruplar', async () => {
    vi.mocked(VeliPlanRepository.listPortalItems).mockResolvedValue({
      data: [
        { id: 'a', subject: 'Matematik', week_start: '2026-09-07', plan_date: null, source: 'Apotemi', description: 'Türev', status: 'yapildi', note: null },
        { id: 'b', subject: 'Matematik', week_start: '2026-09-14', plan_date: '2026-09-15', source: null, description: 'İntegral', status: 'planlandi', note: null },
      ],
      error: null,
    } as never)
    const weeks = await VeliPlanService.getPortalWeeks('stu-1', 'sch-1', '2026-09-10')
    expect(VeliPlanRepository.listPortalItems).toHaveBeenCalledWith('stu-1', 'sch-1', ['2026-09-07', '2026-09-14'])
    expect(weeks.map(w => [w.baslik, w.items.map(i => i.id)])).toEqual([['Bu Hafta', ['a']], ['Gelecek Hafta', ['b']]])
  })

  it('bilinmeyen durum değeri planlandi olarak normalize edilir', async () => {
    vi.mocked(VeliPlanRepository.listPortalItems).mockResolvedValue({
      data: [{ id: 'a', subject: 'M', week_start: '2026-09-07', plan_date: null, source: null, description: 'x', status: '???', note: null }],
      error: null,
    } as never)
    const weeks = await VeliPlanService.getPortalWeeks('stu-1', undefined, '2026-09-10')
    expect(weeks[0].items[0].status).toBe('planlandi')
  })

  it('DB hatasında bölüm gizlenir ([]) ve loglanır', async () => {
    vi.mocked(VeliPlanRepository.listPortalItems).mockResolvedValue({ data: null, error: { message: 'boom' } } as never)
    expect(await VeliPlanService.getPortalWeeks('stu-1', 'sch-1', '2026-09-10')).toEqual([])
    expect(logger.error).toHaveBeenCalled()
  })
})

describe('VeliPlanService.notifyWeek', () => {
  it('öğrenci başına tek link + tek e-posta; jti deterministik, issued_by ilk maddenin öğretmeni', async () => {
    vi.mocked(VeliPlanRepository.listWeekItemsPage).mockResolvedValueOnce({
      data: [row(), row({ teacher_id: 't-2' }), row({ student_id: 'stu-2', students: veli({ veli_email_opt_out: true }) })],
      error: null,
    } as never)
    const r = await VeliPlanService.notifyWeek(WEEK, BASE)

    expect(r).toEqual({ sent: 1, failed: 0 })
    expect(createPublicToken).toHaveBeenCalledWith('veli', 'stu-1', 7, { school_id: 'sch-1' }, 'plan-2026-09-14-stu-1')
    expect(VeliPlanRepository.insertVeliTokens).toHaveBeenCalledWith([expect.objectContaining({
      student_id: 'stu-1', school_id: 'sch-1', issued_by: 't-1', jti: 'plan-2026-09-14-stu-1',
    })])
    expect(mailer.sendMail).toHaveBeenCalledTimes(1)
    const mail = vi.mocked(mailer.sendMail).mock.calls[0][0]
    expect(mail.to).toBe('veli@test.com')
    expect(mail.subject).toBe('Haftaya çalışma planı hazır — Ayşe Yılmaz')
    expect(mail.html).toContain(`${BASE}/veli/v1.tok-plan-2026-09-14-stu-1`)
  })

  it('bu hafta için zaten link kaydı olan öğrenciye tekrar gönderilmez (idempotent)', async () => {
    vi.mocked(VeliPlanRepository.listWeekItemsPage).mockResolvedValueOnce({ data: [row()], error: null } as never)
    vi.mocked(VeliPlanRepository.listNotifiedPage).mockResolvedValueOnce({ data: [{ student_id: 'stu-1' }], error: null } as never)
    const r = await VeliPlanService.notifyWeek(WEEK, BASE)
    expect(VeliPlanRepository.listNotifiedPage).toHaveBeenCalledWith(WEEK, 0, 999)
    expect(r).toEqual({ sent: 0, failed: 0 })
    expect(VeliPlanRepository.insertVeliTokens).not.toHaveBeenCalled()
    expect(mailer.sendMail).not.toHaveBeenCalled()
  })

  it('plan yoksa hiçbir şey yapmaz', async () => {
    expect(await VeliPlanService.notifyWeek(WEEK, BASE)).toEqual({ sent: 0, failed: 0 })
    expect(mailer.sendMail).not.toHaveBeenCalled()
  })

  it('1000 satırlık sayfadan sonra sonraki sayfayı da okur', async () => {
    const full = Array.from({ length: 1000 }, (_, i) => row({ student_id: `stu-${i}`, students: veli({ veli_email: null }) }))
    vi.mocked(VeliPlanRepository.listWeekItemsPage)
      .mockResolvedValueOnce({ data: full, error: null } as never)
      .mockResolvedValueOnce({ data: [row({ student_id: 'son' })], error: null } as never)
    const r = await VeliPlanService.notifyWeek(WEEK, BASE)
    expect(VeliPlanRepository.listWeekItemsPage).toHaveBeenNthCalledWith(2, WEEK, 1000, 1999)
    expect(r.sent).toBe(1)
  })

  it('madde sorgusu hatası → throw (Inngest retry), e-posta yok', async () => {
    vi.mocked(VeliPlanRepository.listWeekItemsPage).mockResolvedValueOnce({ data: null, error: { message: 'db down' } } as never)
    await expect(VeliPlanService.notifyWeek(WEEK, BASE)).rejects.toThrow('db down')
    expect(mailer.sendMail).not.toHaveBeenCalled()
  })

  it('dedup sorgusu hatası → throw (fail-closed: kör gönderim yok)', async () => {
    vi.mocked(VeliPlanRepository.listWeekItemsPage).mockResolvedValueOnce({ data: [row()], error: null } as never)
    vi.mocked(VeliPlanRepository.listNotifiedPage).mockResolvedValueOnce({ data: null, error: { message: 'dedup down' } } as never)
    await expect(VeliPlanService.notifyWeek(WEEK, BASE)).rejects.toThrow('dedup down')
    expect(mailer.sendMail).not.toHaveBeenCalled()
  })

  it('link kaydı yazılamazsa throw ve e-posta gönderilmez (kayıtsız/iptal edilemez link dağıtılmaz)', async () => {
    vi.mocked(VeliPlanRepository.listWeekItemsPage).mockResolvedValueOnce({ data: [row()], error: null } as never)
    vi.mocked(VeliPlanRepository.insertVeliTokens).mockResolvedValueOnce({ error: { message: 'insert fail' } } as never)
    await expect(VeliPlanService.notifyWeek(WEEK, BASE)).rejects.toThrow('insert fail')
    expect(mailer.sendMail).not.toHaveBeenCalled()
  })

  it('e-posta hatası sayılır ve loglanır, fonksiyon patlamaz', async () => {
    vi.mocked(VeliPlanRepository.listWeekItemsPage).mockResolvedValueOnce({
      data: [row(), row({ student_id: 'stu-2', students: veli({ veli_email: 'b@test.com' }) })],
      error: null,
    } as never)
    vi.mocked(mailer.sendMail).mockRejectedValueOnce(new Error('resend'))
    expect(await VeliPlanService.notifyWeek(WEEK, BASE)).toEqual({ sent: 1, failed: 1 })
    expect(logger.error).toHaveBeenCalled()
  })
})
