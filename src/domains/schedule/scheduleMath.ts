export interface Period { no: number; start: string; end: string } // "HH:MM"
export interface Slot { day: number; period: number; class_id: string }
export interface TodayLesson { period: number; start: string; end: string; classId: string }

// Varsayılan zil çizelgesi (09:00 başlangıç; öğretmen UI'dan düzenler).
// Ders 35 dk. İlk teneffüs 10 dk, diğerleri 5 dk. Öğle = 6.→7. arası (13:00–13:40).
// Teneffüs/öğle ayrı satır değil — periyot araları boşluktur.
export const DEFAULT_PERIODS: Period[] = [
  { no: 1, start: '09:00', end: '09:35' },
  { no: 2, start: '09:45', end: '10:20' },
  { no: 3, start: '10:25', end: '11:00' },
  { no: 4, start: '11:05', end: '11:40' },
  { no: 5, start: '11:45', end: '12:20' },
  { no: 6, start: '12:25', end: '13:00' },
  { no: 7, start: '13:40', end: '14:15' },
  { no: 8, start: '14:20', end: '14:55' },
  { no: 9, start: '15:00', end: '15:35' },
]

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

// "HH:MM" sıfır dolgulu olduğundan sözlük sırası = kronolojik sıra.
export function validatePeriods(periods: Period[]): string | null {
  if (!Array.isArray(periods) || periods.length < 1) return 'En az bir ders saati gerekli'
  if (periods.length > 12) return 'En fazla 12 ders saati olabilir'
  const seen = new Set<number>()
  let prevEnd = ''
  for (const p of periods) {
    if (!TIME_RE.test(p.start) || !TIME_RE.test(p.end)) return 'Saat biçimi HH:MM olmalı'
    if (p.start >= p.end) return `${p.no}. ders: başlangıç bitişten önce olmalı`
    if (seen.has(p.no)) return `Tekrarlanan ders no: ${p.no}`
    seen.add(p.no)
    if (prevEnd && p.start < prevEnd) return 'Ders saatleri çakışıyor / sıralı değil'
    prevEnd = p.end
  }
  return null
}

export function validateSlots(slots: Slot[], periods: Period[], validClassIds: string[]): string | null {
  const periodNos = new Set(periods.map(p => p.no))
  const classes = new Set(validClassIds)
  const cells = new Set<string>()
  for (const s of slots) {
    if (!Number.isInteger(s.day) || s.day < 1 || s.day > 5) return 'Geçersiz gün'
    if (!periodNos.has(s.period)) return `Geçersiz ders saati: ${s.period}`
    if (!classes.has(s.class_id)) return 'Geçersiz sınıf seçimi'
    const key = `${s.day}-${s.period}`
    if (cells.has(key)) return 'Aynı saatte birden fazla sınıf seçilemez'
    cells.add(key)
  }
  return null
}

export function todaysLessons(slots: Slot[], periods: Period[], day: number): TodayLesson[] {
  const byNo = new Map(periods.map(p => [p.no, p]))
  return slots
    .filter(s => s.day === day && byNo.has(s.period))
    .map(s => {
      const p = byNo.get(s.period)!
      return { period: p.no, start: p.start, end: p.end, classId: s.class_id }
    })
    .sort((a, b) => a.start.localeCompare(b.start))
}

export function formatOzetBody(items: { period: number; className: string }[]): string {
  return items
    .slice()
    .sort((a, b) => a.period - b.period)
    .map(i => `${i.period}. ders ${i.className}`)
    .join(' · ')
}
