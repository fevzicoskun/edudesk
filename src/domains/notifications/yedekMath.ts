/** Haftalık yedek için saf yardımcılar — cron'dan ayrı test edilebilsin diye burada. */

/**
 * Yedeğe giren tablolar: kaybı geri getirilemez okul verisi.
 *
 * Dışarıda bırakılanlar bilinçli — yeniden üretilebilir (notifications, usage_daily,
 * student_risk_history) ya da zaten iz kaydı (audit_logs, teacher_activity_log,
 * app_errors, revoked_tokens). Yedeğin küçük kalması, geri yüklemeyi de kolaylaştırır.
 */
export const YEDEKLENEN_TABLOLAR = [
  // Kimlik ve yapı
  'schools', 'profiles', 'classes', 'students', 'teacher_classes',
  'roles', 'user_roles', 'permissions', 'role_permissions', 'user_permissions',
  // Günlük iş
  'homeworks', 'homework_submissions', 'attendance', 'lesson_schedules',
  'teacher_duties', 'school_events', 'announcements',
  // Öğrenci takibi
  'mentorships', 'mentor_profiles', 'mentor_reports',
  'student_notes', 'kanaat_notlari', 'parent_meetings', 'parent_contact_logs',
  'study_plan_items', 'student_sources', 'homework_sources',
  // Değerlendirme
  'grade_columns', 'grade_entries', 'common_exams', 'exam_entries',
  'notebook_checks', 'sok_reports', 'curriculum_progress',
  'annual_plans', 'daily_plans', 'zumre_meetings', 'zumre_meeting_templates',
  'ogretmen_dosyasi', 'tasks',
  // Para
  'school_payments',
] as const

/** id kolonu olmayan tabloların birincil anahtarı (DB'den doğrulandı 2026-09-24). */
const BILESIK_ANAHTAR: Partial<Record<(typeof YEDEKLENEN_TABLOLAR)[number], string[]>> = {
  teacher_classes:  ['teacher_id', 'class_id'],
  user_roles:       ['user_id', 'role_id'],
  role_permissions: ['role_id', 'permission_id'],
  user_permissions: ['user_id', 'permission_id'],
  ogretmen_dosyasi: ['teacher_id', 'academic_year'],
}

/** Sayfalı okuma için kararlı sıralama — sırasız sayfalamada satır atlanabilir/tekrarlanabilir. */
export function yedekSiralama(tablo: (typeof YEDEKLENEN_TABLOLAR)[number]): string[] {
  return BILESIK_ANAHTAR[tablo] ?? ['id']
}

/** 12 hafta = 84 gün. Bu süreden eski yedekler temizlenir. */
const SAKLAMA_GUN = 84

const DOSYA_DESENI = /^(\d{4})-(\d{2})-(\d{2})-yedek\.json$/

export function yedekDosyaAdi(tarih: Date): string {
  const yil = tarih.getUTCFullYear()
  const ay  = String(tarih.getUTCMonth() + 1).padStart(2, '0')
  const gun = String(tarih.getUTCDate()).padStart(2, '0')
  return `${yil}-${ay}-${gun}-yedek.json`
}

/** Elle konmuş veya adı tanınmayan dosyalar ASLA silinmez — tanıdığımızı silelim. */
export function eskiYedekMi(dosyaAdi: string, bugun: Date): boolean {
  const eslesme = DOSYA_DESENI.exec(dosyaAdi)
  if (!eslesme) return false

  const [, yil, ay, gun] = eslesme
  const tarih = new Date(Date.UTC(Number(yil), Number(ay) - 1, Number(gun)))
  if (Number.isNaN(tarih.getTime())) return false

  const gecenGun = Math.floor((bugun.getTime() - tarih.getTime()) / 86_400_000)
  return gecenGun > SAKLAMA_GUN
}
