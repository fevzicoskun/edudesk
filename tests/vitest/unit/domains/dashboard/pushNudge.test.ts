import { describe, it, expect } from 'vitest'
import { shouldShowPushNudge, NUDGE_SNOOZE_DAYS, NUDGE_STORAGE_KEY } from '@/src/domains/dashboard/lib/pushNudge'

describe('shouldShowPushNudge', () => {
  const now = new Date('2026-07-04T10:00:00Z')

  it('hiç kapatılmamış (null) → göster', () => {
    expect(shouldShowPushNudge(null, now)).toBe(true)
  })

  it('bozuk zaman damgası → göster (fail-open)', () => {
    expect(shouldShowPushNudge('garbage', now)).toBe(true)
  })

  it('13 gün önce kapatılmış → gizle', () => {
    expect(shouldShowPushNudge('2026-06-21T10:00:00Z', now)).toBe(false)
  })

  it('tam 14 gün önce kapatılmış → göster (sınır dahil)', () => {
    expect(shouldShowPushNudge('2026-06-20T10:00:00Z', now)).toBe(true)
  })

  it('15 gün önce kapatılmış → göster', () => {
    expect(shouldShowPushNudge('2026-06-19T10:00:00Z', now)).toBe(true)
  })

  it('sabitler dışa aktarılmış', () => {
    expect(NUDGE_SNOOZE_DAYS).toBe(14)
    expect(NUDGE_STORAGE_KEY).toBe('edudesk-push-nudge-dismissed-at')
  })
})
