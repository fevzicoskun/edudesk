export interface VeliEvent {
  event_type: string
  section: string | null
  duration_sec: number | null
  created_at: string
}

export interface VeliAnalyticsResult {
  totalViews: number
  lastViewedAt: string | null
  totalDurationSec: number
  sections: string[]
}

export function aggregateVeliEvents(events: VeliEvent[]): VeliAnalyticsResult | null {
  if (!events.length) return null
  const pageViews   = events.filter(e => e.event_type === 'page_view')
  const sessionEnds = events.filter(e => e.event_type === 'session_end')
  const sectionViews = events.filter(e => e.event_type === 'section_view')
  return {
    totalViews:       pageViews.length,
    lastViewedAt:     pageViews[0]?.created_at ?? null,
    totalDurationSec: sessionEnds.reduce((sum, e) => sum + (e.duration_sec ?? 0), 0),
    sections:         [...new Set(sectionViews.map(e => e.section).filter((s): s is string => s !== null))],
  }
}

export function buildWhatsAppUrl(studentName: string, veliAd: string | null, portalUrl: string): string {
  const greeting = veliAd ? `Sayın ${veliAd},` : 'Merhaba,'
  const text = `${greeting} ${studentName} için EduDesk veli portalı: ${portalUrl}`
  return `https://wa.me/?text=${encodeURIComponent(text)}`
}
