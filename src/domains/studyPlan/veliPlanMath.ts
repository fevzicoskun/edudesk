// Haftalık Çalışma Planı v2 — veli portalı + Pazar akşamı veli bildirimi için saf mantık.
// Spec: docs/superpowers/specs/2026-09-09-haftalik-calisma-plani-design.md (## v2)
import { esc } from '@/src/lib/email-utils'
import { PLAN_STATUSES, formatWeekLabel, shiftWeek, weekStartOf, weekSummary, type PlanStatus, type WeekSummary } from './planMath'

export interface VeliPlanItem {
  id: string
  subject: string
  week_start: string
  plan_date: string | null
  source: string | null
  description: string
  status: PlanStatus
  note: string | null
}

export interface PortalWeek {
  weekStart: string
  baslik: 'Bu Hafta' | 'Gelecek Hafta'
  aralik: string
  ozet: WeekSummary
  items: VeliPlanItem[]
}

/** Veli portalında gösterilen iki hafta: [içinde bulunulan, gelecek]. */
export function portalWeekStarts(todayISO: string): [string, string] {
  const bu = weekStartOf(todayISO)
  return [bu, shiftWeek(bu, 1)]
}

export function nextWeekStart(todayISO: string): string {
  return shiftWeek(weekStartOf(todayISO), 1)
}

export function toPlanStatus(s: string): PlanStatus {
  return (PLAN_STATUSES as readonly string[]).includes(s) ? (s as PlanStatus) : 'planlandi'
}

/** Boş haftalar atlanır; hiç madde yoksa [] → bölüm render edilmez. */
export function groupPortalWeeks(items: VeliPlanItem[], todayISO: string): PortalWeek[] {
  const [bu, gelecek] = portalWeekStarts(todayISO)
  const weeks: PortalWeek[] = []
  for (const [weekStart, baslik] of [[bu, 'Bu Hafta'], [gelecek, 'Gelecek Hafta']] as const) {
    // "Hafta" (plan_date null) maddeleri önce, sonra gün sırası — v1 repository sıralamasıyla aynı. sort stabil.
    const weekItems = items
      .filter(i => i.week_start === weekStart)
      .sort((a, b) => (a.plan_date ?? '').localeCompare(b.plan_date ?? ''))
    if (!weekItems.length) continue
    weeks.push({ weekStart, baslik, aralik: formatWeekLabel(weekStart), ozet: weekSummary(weekItems), items: weekItems })
  }
  return weeks
}

// ── Pazar bildirimi ────────────────────────────────────────────────────────────

// Dedup işareti: bildirim e-postasındaki veli linkinin jti'si hafta+öğrenci ile deterministik.
// veli_tokens'ta bu jti'nin kaydı = "bu hafta bu veliye gönderildi" (migration'sız, DB-kalıcı).
export function planVeliJtiPrefix(weekStart: string): string {
  return `plan-${weekStart}-`
}
export function planVeliJti(weekStart: string, studentId: string): string {
  return `${planVeliJtiPrefix(weekStart)}${studentId}`
}

export interface NotifyItemRow {
  student_id: string
  school_id: string
  teacher_id: string
  students: {
    full_name: string
    veli_email: string | null
    veli_ad: string | null
    veli_email_opt_out: boolean
    deleted_at: string | null
  } | null
}

export interface PlanNotifyTarget {
  studentId: string
  schoolId: string
  /** Linki "veren" öğretmen (veli_tokens.issued_by) — öğrencinin o haftadaki ilk maddesinin sahibi. */
  teacherId: string
  to: string
  veliAd: string | null
  ogrenciAdi: string
}

/** Madde satırlarından öğrenci başına tek hedef; e-postasız/opt-out/silinmiş/zaten bildirilmiş öğrenciler elenir. */
export function selectPlanNotifyTargets(rows: NotifyItemRow[], alreadySent: ReadonlySet<string>): PlanNotifyTarget[] {
  const seen = new Set<string>()
  const targets: PlanNotifyTarget[] = []
  for (const r of rows) {
    if (seen.has(r.student_id)) continue
    seen.add(r.student_id)
    const s = r.students
    const to = s?.veli_email?.trim()
    if (!s || !to || s.veli_email_opt_out || s.deleted_at || alreadySent.has(r.student_id)) continue
    targets.push({ studentId: r.student_id, schoolId: r.school_id, teacherId: r.teacher_id, to, veliAd: s.veli_ad, ogrenciAdi: s.full_name })
  }
  return targets
}

export function buildPlanHazirEmail(o: {
  veliAd: string | null
  ogrenciAdi: string
  weekStart: string
  portalUrl: string
  unsubscribeUrl: string
}): { subject: string; html: string } {
  return {
    subject: `Haftaya çalışma planı hazır — ${o.ogrenciAdi}`,
    html: `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>body{font-family:sans-serif;color:#1f2937;line-height:1.6}
.box{max-width:520px;margin:32px auto;padding:32px;border:1px solid #e5e7eb;border-radius:12px}
.badge{display:inline-block;background:#eff6ff;color:#1d4ed8;padding:4px 10px;border-radius:6px;font-size:13px;font-weight:600}
.btn{display:inline-block;background:#4f46e5;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600}
.footer{margin-top:24px;padding-top:16px;border-top:1px solid #f3f4f6;font-size:12px;color:#6b7280}</style></head>
<body><div class="box">
<p>${esc(o.veliAd ?? 'Sayın Veli')},</p>
<p><strong>${esc(o.ogrenciAdi)}</strong> için haftaya çalışma planı hazır:</p>
<p class="badge">${esc(formatWeekLabel(o.weekStart))}</p>
<p>Planı ve günlük maddeleri veli portalından görüntüleyebilirsiniz.</p>
<p><a href="${esc(o.portalUrl)}" class="btn">Çalışma Planını Gör</a></p>
<div class="footer">EduDesk — Okul Takip Sistemi<br>
Bu bildirimleri durdurmak için <a href="${esc(o.unsubscribeUrl)}" style="color:#6b7280">buraya tıklayın</a>.</div>
</div></body></html>`,
  }
}
