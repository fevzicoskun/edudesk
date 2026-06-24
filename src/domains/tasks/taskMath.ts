// Yapılacaklarım: saf görünürlük/erteleme/doğrulama mantığı (DB'siz, test edilebilir).
// Tarih string'leri 'YYYY-MM-DD'; leksikografik karşılaştırma kronolojik sıraya eştir.

export interface TaskRow {
  id: string
  title: string
  student_id: string | null
  class_id: string | null
  due_date: string | null
  snoozed_until: string | null
  done_at: string | null
}

function toStr(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// Bugünün yerel tarihi (UTC offset hatası olmadan).
export function todayStr(d: Date = new Date()): string {
  return toStr(d)
}

// Erteleme hedef tarihi: yarın (+1) veya gelecek hafta (+7).
export function snoozeDate(base: Date, option: 'tomorrow' | 'nextWeek'): string {
  const d = new Date(base)
  d.setDate(d.getDate() + (option === 'tomorrow' ? 1 : 7))
  return toStr(d)
}

// Bugün görünür mü: açık VE (ertelenmemiş ya da erteleme günü gelmiş).
export function isVisibleToday(
  t: Pick<TaskRow, 'done_at' | 'snoozed_until'>,
  today: string,
): boolean {
  if (t.done_at) return false
  return t.snoozed_until == null || t.snoozed_until <= today
}

// Gecikmiş mi: açık VE due_date bugünden önce.
export function isOverdue(
  t: Pick<TaskRow, 'done_at' | 'due_date'>,
  today: string,
): boolean {
  if (t.done_at || t.due_date == null) return false
  return t.due_date < today
}

// Başlık doğrulama: 1–200 karakter (trim sonrası). Hata mesajı veya null.
export function validateTaskTitle(title: string): string | null {
  const t = (title ?? '').trim()
  if (t.length < 1) return 'Görev metni zorunludur'
  if (t.length > 200) return 'Görev en fazla 200 karakter olabilir'
  return null
}
