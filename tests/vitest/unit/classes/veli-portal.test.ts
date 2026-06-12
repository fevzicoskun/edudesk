import { describe, it, expect } from 'vitest'
import { aggregateVeliEvents, buildWhatsAppUrl } from '@/src/domains/classes/lib/veliPortal'

describe('aggregateVeliEvents', () => {
  it('returns null for empty events', () => {
    expect(aggregateVeliEvents([])).toBeNull()
  })

  it('counts page_view events as totalViews', () => {
    const events = [
      { event_type: 'page_view',    section: null,       duration_sec: null, created_at: '2026-06-12T10:00:00Z' },
      { event_type: 'page_view',    section: null,       duration_sec: null, created_at: '2026-06-11T10:00:00Z' },
      { event_type: 'section_view', section: 'odevler',  duration_sec: null, created_at: '2026-06-12T10:01:00Z' },
      { event_type: 'section_view', section: 'odevler',  duration_sec: null, created_at: '2026-06-12T10:02:00Z' },
      { event_type: 'session_end',  section: null,       duration_sec: 300,  created_at: '2026-06-12T10:05:00Z' },
    ]
    const result = aggregateVeliEvents(events)!
    expect(result.totalViews).toBe(2)
    expect(result.totalDurationSec).toBe(300)
    expect(result.sections).toEqual(['odevler'])
    expect(result.lastViewedAt).toBe('2026-06-12T10:00:00Z')
  })

  it('sums duration across multiple sessions', () => {
    const events = [
      { event_type: 'session_end', section: null, duration_sec: 120, created_at: '2026-06-11T10:00:00Z' },
      { event_type: 'session_end', section: null, duration_sec: 180, created_at: '2026-06-12T10:00:00Z' },
    ]
    expect(aggregateVeliEvents(events)!.totalDurationSec).toBe(300)
  })
})

describe('buildWhatsAppUrl', () => {
  it('includes veli adı in greeting when provided', () => {
    const url = buildWhatsAppUrl('Ali Vural', 'Fatma Hanım', 'https://myedudesk.com.tr/veli/v1.abc')
    expect(decodeURIComponent(url)).toContain('Sayın Fatma Hanım')
    expect(decodeURIComponent(url)).toContain('Ali Vural')
  })

  it('uses generic greeting when veliAd is null', () => {
    const url = buildWhatsAppUrl('Ali Vural', null, 'https://myedudesk.com.tr/veli/v1.abc')
    expect(decodeURIComponent(url)).toContain('Merhaba')
    expect(decodeURIComponent(url)).not.toContain('Sayın')
  })

  it('URL encodes the message', () => {
    const url = buildWhatsAppUrl('Ali', null, 'https://example.com')
    expect(url).toMatch(/^https:\/\/wa\.me\/\?text=/)
  })
})
