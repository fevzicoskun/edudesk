// Nöbet bilgisi: saf doğrulama (DB'siz, test edilebilir).
// scheduleMath.ts ile aynı kalıp: hata varsa mesaj, yoksa null döner.

export interface DutyInput {
  day_of_week: number // 1=Pazartesi .. 5=Cuma
  time_range: string // örn. "08:00–08:40"
  location: string // nöbet yeri/konumu
  notes?: string | null // opsiyonel ek not
}

// Girdi: ham nöbet alanları. Çıktı: ilk hata mesajı (string) veya geçerliyse null.
export function validateDuty(input: DutyInput): string | null {
  const { day_of_week, time_range, location, notes } = input

  if (!Number.isInteger(day_of_week) || day_of_week < 1 || day_of_week > 5) {
    return 'Nöbet günü Pazartesi–Cuma arası olmalı'
  }

  const tr = (time_range ?? '').trim()
  if (tr.length < 1) return 'Saat aralığı zorunludur'
  if (tr.length > 40) return 'Saat aralığı en fazla 40 karakter olabilir'

  const loc = (location ?? '').trim()
  if (loc.length < 1) return 'Nöbet yeri zorunludur'
  if (loc.length > 100) return 'Nöbet yeri en fazla 100 karakter olabilir'

  // notes opsiyonel; verildiyse 200 karakteri aşamaz.
  if (notes != null && notes.length > 200) {
    return 'Notlar en fazla 200 karakter olabilir'
  }

  return null
}

// Girdi: nöbet kaydı (yoksa null) + bugünün gün no'su (1=Pzt..5=Cuma).
// Çıktı: bugün nöbet günüyse bildirim satırı, değilse/yoksa null.
export function formatDutyReminder(duty: DutyInput | null, todayDow: number): string | null {
  if (!duty || duty.day_of_week !== todayDow) return null
  const base = `Bugün nöbettesin: ${duty.time_range} · ${duty.location}`
  const note = duty.notes?.trim()
  return note ? `${base} (${note})` : base
}
