import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createAbility } from '@/src/shared/authorization'
import { OGRETMEN_PERMS } from '../../setup/factories'
import type { GrantedPermission } from '@/src/domains/rbac/types'

const SCHOOL_HW_PERMS: GrantedPermission[] = [
  ...OGRETMEN_PERMS,
  { resource: 'homework', action: 'update', scope: 'school', source: 'role' },
]

vi.mock('@/src/shared/authorization/server', () => ({
  getAbility: vi.fn(),
}))

vi.mock('@/src/infrastructure/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/src/lib/mailer', () => ({
  mailer: { sendMail: vi.fn() },
}))

const { getAbility }   = await import('@/src/shared/authorization/server')
const { createClient } = await import('@/src/infrastructure/supabase/server')
const { mailer }       = await import('@/src/lib/mailer')
const { sendHomeworkReminderEmails } = await import('@/app/actions/veli-bildirim')

const SCHOOL_ID  = 'school-1'
const TEACHER_ID = 'teacher-1'

function makeAbility(perms = OGRETMEN_PERMS, userId = TEACHER_ID) {
  return createAbility({ userId, schoolId: SCHOOL_ID, permissions: perms })
}

beforeEach(() => { vi.clearAllMocks() })

describe('sendHomeworkReminderEmails()', () => {
  it('giriş yoksa { error } döner', async () => {
    vi.mocked(getAbility).mockResolvedValue(null)
    const result = await sendHomeworkReminderEmails('3fa85f64-5717-4562-b3fc-2c963f66afa6', ['3fa85f64-5717-4562-b3fc-2c963f66afa7'])
    expect(result.error).toBe('Giriş gerekli')
    expect(mailer.sendMail).not.toHaveBeenCalled()
  })

  it('homework:update izni yoksa hata döner', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility([]) as never)
    const result = await sendHomeworkReminderEmails('3fa85f64-5717-4562-b3fc-2c963f66afa6', ['3fa85f64-5717-4562-b3fc-2c963f66afa7'])
    expect(result.error).toBe('Bu işlem için yetkiniz yok.')
  })

  it('boş studentIds ile sent=0 döner, mail gönderilmez', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility() as never)
    const result = await sendHomeworkReminderEmails('3fa85f64-5717-4562-b3fc-2c963f66afa6', [])
    expect(result.sent).toBe(0)
    expect(mailer.sendMail).not.toHaveBeenCalled()
  })
})

// Tablo adına göre veri döndüren zincir taklidi: .select/.eq/.in/.not/... kendini döndürür, await edilince { data, error } verir.
function sahteSupabase(tablolar: Record<string, unknown>) {
  const cagrilar: { tablo: string; yontem: string; args: unknown[] }[] = []
  const zincir = (tablo: string): unknown => new Proxy({}, {
    get(_, yontem: string) {
      if (yontem === 'then') {
        const data = tablolar[tablo]
        return (res: (v: unknown) => void) => res({ data, error: null })
      }
      return (...args: unknown[]) => { cagrilar.push({ tablo, yontem, args }); return zincir(tablo) }
    },
  })
  return { client: { from: (t: string) => zincir(t) }, cagrilar }
}

describe('sendHomeworkReminderEmails() — yalnız gerçekten eksik işaretlenen öğrencilerin velisi', () => {
  const HW = '3fa85f64-5717-4562-b3fc-2c963f66afa6'
  const ISARETLI = '3fa85f64-5717-4562-b3fc-2c963f66afa7'
  const ISARETSIZ = '3fa85f64-5717-4562-b3fc-2c963f66afa8'

  it('işaretlenmemiş öğrencinin velisine "ödev hatırlatması" gitmez (istemci listesine güvenilmez)', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility(SCHOOL_HW_PERMS) as never)
    const { client, cagrilar } = sahteSupabase({
      homeworks: { teacher_id: TEACHER_ID, title: 'Türev', due_date: '2026-09-28', school_id: SCHOOL_ID },
      // sunucu yalnız marked_at dolu + eksik durumdaki satırları döndürür → yalnız ISARETLI
      homework_submissions: [{ student_id: ISARETLI }],
      students: [{ id: ISARETLI, full_name: 'Can Demir', veli_email: 'veli@ornek.com', veli_ad: 'Veli' }],
    })
    vi.mocked(createClient).mockResolvedValue(client as never)
    vi.mocked(mailer.sendMail).mockResolvedValue(undefined as never)

    const result = await sendHomeworkReminderEmails(HW, [ISARETLI, ISARETSIZ])

    expect(result.sent).toBe(1)
    // teslim tablosu sorgulandı: işaretli + eksik durum süzgeci
    const teslim = cagrilar.filter(c => c.tablo === 'homework_submissions')
    expect(teslim.some(c => c.yontem === 'not' && c.args[0] === 'marked_at')).toBe(true)
    expect(teslim.some(c => c.yontem === 'in' && c.args[0] === 'status')).toBe(true)
    // öğrenci sorgusu istemcinin listesiyle değil, doğrulanmış listeyle yapıldı
    const ogrIn = cagrilar.find(c => c.tablo === 'students' && c.yontem === 'in')
    expect(ogrIn?.args[1]).toEqual([ISARETLI])
  })
})
