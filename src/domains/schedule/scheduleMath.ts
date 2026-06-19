export interface Period { no: number; start: string; end: string } // "HH:MM"
export interface Slot { day: number; period: number; class_id: string }
export interface TodayLesson { period: number; start: string; end: string; classId: string }

// Varsayılan zil çizelgesi (08:30 başlangıç varsayımı; öğretmen UI'dan düzenler).
// Teneffüs/öğle ayrı satır değil — periyot araları boşluktur; öğle = 5.→6. arası büyük boşluk.
export const DEFAULT_PERIODS: Period[] = [
  { no: 1, start: '08:30', end: '09:05' },
  { no: 2, start: '09:15', end: '09:50' },
  { no: 3, start: '09:55', end: '10:30' },
  { no: 4, start: '10:35', end: '11:10' },
  { no: 5, start: '11:15', end: '11:50' },
  { no: 6, start: '13:40', end: '14:15' },
  { no: 7, start: '14:20', end: '14:55' },
  { no: 8, start: '15:00', end: '15:35' },
]

const TIME_RE = /^\d{2}:\d{2}$/

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
