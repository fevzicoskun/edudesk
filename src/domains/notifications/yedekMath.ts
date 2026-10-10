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
  'teacher_duties', 'school_events', 'announcements', 'school_meetings', 'user_notes',
  // işaret geçmişi: yanlış toplu işaretlemede kimin neyi değiştirdiğini geri kurmak için
  'homework_submission_logs',
  'veli_tokens', 'notification_preferences', 'platform_admins',
  // Öğrenci takibi
  'mentorships', 'mentor_profiles', 'mentor_reports', 'bulten_gonderimleri',
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
  bulten_gonderimleri:      ['student_id', 'hafta'],
  notification_preferences: ['user_id'],
}

/** Bilinçli olarak yedeğe girmeyen tablolar (yeniden üretilebilir / iz kaydı / geçici).
 *  Yeni tablo ikisinden birine eklenmezse yedek-kapsam entegrasyon testi kırılır. */
export const YEDEK_DISI_TABLOLAR = [
  'notifications', 'usage_daily', 'student_risk_history', 'audit_logs', 'teacher_activity_log',
  'app_errors', 'revoked_tokens', 'user_sessions', 'push_subscriptions', 'announcement_reads',
  'veli_portal_events', 'homework_veli_notifications', 'feedback',
] as const

/** Sayfalı okuma için kararlı sıralama — sırasız sayfalamada satır atlanabilir/tekrarlanabilir. */
export function yedekSiralama(tablo: (typeof YEDEKLENEN_TABLOLAR)[number]): string[] {
  return BILESIK_ANAHTAR[tablo] ?? ['id']
}

/** Yedek her gece alınır: son 30 günün hepsi, 84 güne (12 hafta) kadar yalnız Pazar yedekleri saklanır. */
const GUNLUK_SAKLAMA_GUN = 30
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
  if (gecenGun > SAKLAMA_GUN) return true
  return gecenGun > GUNLUK_SAKLAMA_GUN && tarih.getUTCDay() !== 0
}
