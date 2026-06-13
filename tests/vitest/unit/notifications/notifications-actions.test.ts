import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Thenable chain factory — her method this döner, await chain ile resolve olur.
// then() hook'u Promise.resolve(result) üzerinden çalıştığı için
// supabase query zincirinin sonunda await kullanılabilir.
// ---------------------------------------------------------------------------
function makeChain(result: unknown) {
  const chain: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'is', 'order', 'limit', 'update', 'upsert', 'not', 'in', 'head']) {
    chain[m] = vi.fn().mockReturnValue(chain)
  }
  // single() doğrudan Promise döndürür (thenable chain'den ayrı)
  chain.single = vi.fn().mockResolvedValue(result)
  // await chain → then() üzerinden resolve
  chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve)
  return chain
}

function makeSupabase(result: unknown = { data: null, error: null }) {
  const chain = makeChain(result)
  return { from: vi.fn().mockReturnValue(chain), _chain: chain }
}

// ---------------------------------------------------------------------------
// Mock tanımları — vi.mock hoisted olduğu için dosyanın en üstünde olmalı
// ---------------------------------------------------------------------------
vi.mock('@/src/infrastructure/supabase/server', () => ({
  createClient: vi.fn(),
}))
vi.mock('@/src/shared/auth', () => ({
  getCurrentUser: vi.fn(),
  getCurrentProfile: vi.fn(),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

// ---------------------------------------------------------------------------
// Dynamic import — mock'lar registre edildikten sonra yükle
// ---------------------------------------------------------------------------
const { createClient } = await import('@/src/infrastructure/supabase/server')
const { getCurrentUser } = await import('@/src/shared/auth')
const {
  getNotifications,
  getUnreadCount,
  markAllRead,
  markRead,
  getNotificationPreferences,
  saveNotificationPreferences,
} = await import('@/src/domains/notifications/actions/index')

const MOCK_USER = { id: 'user-1' }

beforeEach(() => vi.clearAllMocks())

// ===========================================================================
// getNotifications()
// ===========================================================================
describe('getNotifications()', () => {
  it('kullanıcı yoksa boş dizi döner', async () => {
    // Promise.all içinde createClient DA çağrılır — mock'lamak gerekiyor
    vi.mocked(createClient).mockResolvedValue(makeSupabase() as never)
    vi.mocked(getCurrentUser).mockResolvedValue(null)
    const result = await getNotifications()
    expect(result).toEqual([])
  })

  it('kullanıcı varsa supabase sorgusu çalışır ve data döner', async () => {
    const notifications = [
      { id: 'n1', title: 'Test', body: null, homework_id: null, read_at: null, created_at: '2026-01-01' },
    ]
    vi.mocked(getCurrentUser).mockResolvedValue(MOCK_USER as never)
    vi.mocked(createClient).mockResolvedValue(makeSupabase({ data: notifications, error: null }) as never)
    const result = await getNotifications()
    expect(result).toEqual(notifications)
  })

  it('supabase null data döndürürse boş dizi döner', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(MOCK_USER as never)
    vi.mocked(createClient).mockResolvedValue(makeSupabase({ data: null, error: null }) as never)
    const result = await getNotifications()
    expect(result).toEqual([])
  })

  it('from("notifications") ile sorgu yapılır', async () => {
    const mockDb = makeSupabase({ data: [], error: null })
    vi.mocked(getCurrentUser).mockResolvedValue(MOCK_USER as never)
    vi.mocked(createClient).mockResolvedValue(mockDb as never)
    await getNotifications()
    expect(mockDb.from).toHaveBeenCalledWith('notifications')
  })
})

// ===========================================================================
// getUnreadCount()
// ===========================================================================
describe('getUnreadCount()', () => {
  it('kullanıcı yoksa 0 döner', async () => {
    vi.mocked(createClient).mockResolvedValue(makeSupabase() as never)
    vi.mocked(getCurrentUser).mockResolvedValue(null)
    expect(await getUnreadCount()).toBe(0)
  })

  it('kullanıcı varsa count döner', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(MOCK_USER as never)
    vi.mocked(createClient).mockResolvedValue(makeSupabase({ count: 5, error: null }) as never)
    expect(await getUnreadCount()).toBe(5)
  })

  it('supabase null count dönerse 0 döner', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(MOCK_USER as never)
    vi.mocked(createClient).mockResolvedValue(makeSupabase({ count: null, error: null }) as never)
    expect(await getUnreadCount()).toBe(0)
  })

  it('from("notifications") ile sorgu yapılır', async () => {
    const mockDb = makeSupabase({ count: 3, error: null })
    vi.mocked(getCurrentUser).mockResolvedValue(MOCK_USER as never)
    vi.mocked(createClient).mockResolvedValue(mockDb as never)
    await getUnreadCount()
    expect(mockDb.from).toHaveBeenCalledWith('notifications')
  })
})

// ===========================================================================
// markAllRead()
// ===========================================================================
describe('markAllRead()', () => {
  it('kullanıcı yoksa erken döner, from çağrılmaz', async () => {
    const mockDb = makeSupabase()
    vi.mocked(createClient).mockResolvedValue(mockDb as never)
    vi.mocked(getCurrentUser).mockResolvedValue(null)
    await markAllRead()
    // user yoksa .from() hiç çağrılmamalı
    expect(mockDb.from).not.toHaveBeenCalled()
  })

  it('kullanıcı varsa from("notifications") ile update çalışır', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(MOCK_USER as never)
    const mockDb = makeSupabase({ data: null, error: null })
    vi.mocked(createClient).mockResolvedValue(mockDb as never)
    await markAllRead()
    expect(mockDb.from).toHaveBeenCalledWith('notifications')
  })

  it('kullanıcı varsa revalidatePath çağrılır', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(MOCK_USER as never)
    vi.mocked(createClient).mockResolvedValue(makeSupabase({ data: null, error: null }) as never)
    const { revalidatePath } = await import('next/cache')
    await markAllRead()
    expect(revalidatePath).toHaveBeenCalledWith('/', 'layout')
  })
})

// ===========================================================================
// markRead()
// ===========================================================================
describe('markRead()', () => {
  it('kullanıcı yoksa erken döner, from çağrılmaz', async () => {
    const mockDb = makeSupabase()
    vi.mocked(createClient).mockResolvedValue(mockDb as never)
    vi.mocked(getCurrentUser).mockResolvedValue(null)
    await markRead('n1')
    expect(mockDb.from).not.toHaveBeenCalled()
  })

  it('kullanıcı varsa eq("id", notificationId) ile update çalışır', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(MOCK_USER as never)
    const mockDb = makeSupabase({ data: null, error: null })
    vi.mocked(createClient).mockResolvedValue(mockDb as never)
    await markRead('n1')
    const chain = mockDb.from.mock.results[0].value as Record<string, ReturnType<typeof vi.fn>>
    // eq hem user_id hem id için çağrılır
    const eqCalls = (chain.eq as ReturnType<typeof vi.fn>).mock.calls
    expect(eqCalls).toContainEqual(['id', 'n1'])
  })

  it('kullanıcı varsa revalidatePath çağrılır', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(MOCK_USER as never)
    vi.mocked(createClient).mockResolvedValue(makeSupabase({ data: null, error: null }) as never)
    const { revalidatePath } = await import('next/cache')
    await markRead('n1')
    expect(revalidatePath).toHaveBeenCalledWith('/', 'layout')
  })
})

// ===========================================================================
// getNotificationPreferences()
// ===========================================================================
describe('getNotificationPreferences()', () => {
  it('kullanıcı yoksa null döner', async () => {
    vi.mocked(createClient).mockResolvedValue(makeSupabase() as never)
    vi.mocked(getCurrentUser).mockResolvedValue(null)
    expect(await getNotificationPreferences()).toBeNull()
  })

  it('tercih varsa veriyi döner', async () => {
    const prefs = { days_before: 2, email_on: false }
    vi.mocked(getCurrentUser).mockResolvedValue(MOCK_USER as never)
    // single() mock'u doğrudan resolve edecek
    vi.mocked(createClient).mockResolvedValue(makeSupabase({ data: prefs, error: null }) as never)
    expect(await getNotificationPreferences()).toEqual(prefs)
  })

  it('tercih yoksa (data: null) varsayılan döner', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(MOCK_USER as never)
    vi.mocked(createClient).mockResolvedValue(makeSupabase({ data: null, error: null }) as never)
    const result = await getNotificationPreferences()
    expect(result).toEqual({ days_before: 1, email_on: true })
  })

  it('from("notification_preferences") ile sorgu yapılır', async () => {
    const mockDb = makeSupabase({ data: { days_before: 1, email_on: true }, error: null })
    vi.mocked(getCurrentUser).mockResolvedValue(MOCK_USER as never)
    vi.mocked(createClient).mockResolvedValue(mockDb as never)
    await getNotificationPreferences()
    expect(mockDb.from).toHaveBeenCalledWith('notification_preferences')
  })
})

// ===========================================================================
// saveNotificationPreferences()
// ===========================================================================
function makeFormData(days: string, emailOn: string | null) {
  const fd = new FormData()
  fd.set('days_before', days)
  if (emailOn !== null) fd.set('email_on', emailOn)
  return fd
}

describe('saveNotificationPreferences()', () => {
  it('kullanıcı yoksa erken döner, from çağrılmaz', async () => {
    const mockDb = makeSupabase()
    vi.mocked(createClient).mockResolvedValue(mockDb as never)
    vi.mocked(getCurrentUser).mockResolvedValue(null)
    await saveNotificationPreferences(makeFormData('2', 'on'))
    expect(mockDb.from).not.toHaveBeenCalled()
  })

  it('days_before 0 → 1 olarak kısıtlanır', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(MOCK_USER as never)
    const mockDb = makeSupabase({ data: null, error: null })
    vi.mocked(createClient).mockResolvedValue(mockDb as never)
    await saveNotificationPreferences(makeFormData('0', 'on'))
    const chain = mockDb.from.mock.results[0].value as Record<string, ReturnType<typeof vi.fn>>
    const upsertArg = (chain.upsert as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(upsertArg.days_before).toBe(1)
  })

  it('days_before 8 → 7 olarak kısıtlanır', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(MOCK_USER as never)
    const mockDb = makeSupabase({ data: null, error: null })
    vi.mocked(createClient).mockResolvedValue(mockDb as never)
    await saveNotificationPreferences(makeFormData('8', null))
    const chain = mockDb.from.mock.results[0].value as Record<string, ReturnType<typeof vi.fn>>
    const upsertArg = (chain.upsert as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(upsertArg.days_before).toBe(7)
  })

  it('email_on "on" → true olarak kaydedilir', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(MOCK_USER as never)
    const mockDb = makeSupabase({ data: null, error: null })
    vi.mocked(createClient).mockResolvedValue(mockDb as never)
    await saveNotificationPreferences(makeFormData('3', 'on'))
    const chain = mockDb.from.mock.results[0].value as Record<string, ReturnType<typeof vi.fn>>
    const upsertArg = (chain.upsert as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(upsertArg.email_on).toBe(true)
  })

  it('email_on eksik → false olarak kaydedilir', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(MOCK_USER as never)
    const mockDb = makeSupabase({ data: null, error: null })
    vi.mocked(createClient).mockResolvedValue(mockDb as never)
    await saveNotificationPreferences(makeFormData('3', null))
    const chain = mockDb.from.mock.results[0].value as Record<string, ReturnType<typeof vi.fn>>
    const upsertArg = (chain.upsert as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(upsertArg.email_on).toBe(false)
  })

  it('upsert sonrası revalidatePath("/ayarlar") çağrılır', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(MOCK_USER as never)
    vi.mocked(createClient).mockResolvedValue(makeSupabase({ data: null, error: null }) as never)
    const { revalidatePath } = await import('next/cache')
    await saveNotificationPreferences(makeFormData('3', 'on'))
    expect(revalidatePath).toHaveBeenCalledWith('/ayarlar')
  })

  it('from("notification_preferences") ile upsert çalışır', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(MOCK_USER as never)
    const mockDb = makeSupabase({ data: null, error: null })
    vi.mocked(createClient).mockResolvedValue(mockDb as never)
    await saveNotificationPreferences(makeFormData('3', 'on'))
    expect(mockDb.from).toHaveBeenCalledWith('notification_preferences')
  })
})
