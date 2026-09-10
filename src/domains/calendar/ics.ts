// ICS (RFC 5545) yazıcı — saf, DB/IO yok. Takvim aboneliği beslemesi (/api/takvim/ics) kullanır.
// Zamanlar: saatli olay İstanbul yerel saatinden UTC'ye (Z) çevrilir; tüm-gün olay VALUE=DATE ile
// yerel tarih string'inden doğrudan yazılır (Date'e çevrilmez → İstanbul-günü kayması olmaz).

import { addDaysISO, istanbulLocalToUtc } from '@/src/shared/date'
import type { CalendarEvent } from './calendarMath'

const CRLF = '\r\n'
const MAX_OCTETS = 75
const UID_DOMAIN = 'myedudesk.com.tr'

/** TEXT değer kaçışı: \ ; , ve satır sonları. */
export function escapeIcsText(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n')
}

function utf8Octets(codePoint: number): number {
  if (codePoint < 0x80) return 1
  if (codePoint < 0x800) return 2
  if (codePoint < 0x10000) return 3
  return 4
}

/** 75 oktet satır katlama. for..of kod noktası üzerinde döner → çok baytlı karakter/surrogate çifti bölünmez.
 *  Devam satırı boşlukla başlar; boşluk da 75 okteti sayılır. */
export function foldIcsLine(line: string): string {
  const parts: string[] = []
  let current = ''
  let octets = 0
  for (const ch of line) {
    const len = utf8Octets(ch.codePointAt(0) ?? 0)
    if (octets + len > MAX_OCTETS) {
      parts.push(current)
      current = ' '
      octets = 1
    }
    current += ch
    octets += len
  }
  parts.push(current)
  return parts.join(CRLF)
}

function utcStamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

function dateValue(iso: string): string {
  return iso.replace(/-/g, '')
}

// id'siz kaynaklar (tatil) için başlıktan kısa, deterministik özet.
function fnv1a(s: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16)
}

// Stabil UID: kaynak + kayıt id + tarih. Tarih, haftalık tekrarlanan nöbetin her gününü ayırır.
function eventUid(e: CalendarEvent): string {
  return `${e.type}-${e.id ?? fnv1a(e.title)}-${dateValue(e.date)}@${UID_DOMAIN}`
}

export function buildIcsCalendar(events: CalendarEvent[], now: Date): string {
  const stamp = utcStamp(now)
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//EduDesk//Takvim//TR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:EduDesk',
    'X-WR-TIMEZONE:Europe/Istanbul',
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
    'X-PUBLISHED-TTL:PT1H',
  ]

  for (const e of events) {
    lines.push('BEGIN:VEVENT', `UID:${eventUid(e)}`, `DTSTAMP:${stamp}`)
    if (e.start && e.end) {
      lines.push(
        `DTSTART:${utcStamp(istanbulLocalToUtc(e.date, e.start))}`,
        `DTEND:${utcStamp(istanbulLocalToUtc(e.date, e.end))}`,
      )
    } else {
      // Tüm-gün: DTEND hariç (exclusive) → ertesi gün.
      lines.push(
        `DTSTART;VALUE=DATE:${dateValue(e.date)}`,
        `DTEND;VALUE=DATE:${dateValue(addDaysISO(e.date, 1))}`,
        'TRANSP:TRANSPARENT',
      )
    }
    lines.push(`SUMMARY:${escapeIcsText(e.title)}`)
    if (e.detail) lines.push(`DESCRIPTION:${escapeIcsText(e.detail)}`)
    lines.push('END:VEVENT')
  }

  lines.push('END:VCALENDAR')
  return lines.map(foldIcsLine).join(CRLF) + CRLF
}
