// Pazartesi haftalık özet maili — saf içerik kurucu (cron: functions/haftalikOzet.ts).
// Kaynak ana sayfayla aynı: riskler computeAlerts, ödevler fetchRiskInputs (son 90 gün + gelecek).
import { esc } from '@/src/lib/email-utils'
import { addDaysISO, format, parseISO } from '@/src/shared/date'
import type { RiskAlert } from '@/src/domains/dashboard/types'
import type { HwRow } from '@/src/domains/dashboard/lib/riskEngine'

/** Okulun geçiş haftası (12 Ekim) atlanır — kullanıcı kararı 2026-10-11 */
export const HAFTALIK_OZET_BASLANGIC = '2026-10-19'
const AZAMI = 5

export type OzetGirdi = {
  ad: string
  bugun: string // YYYY-MM-DD (İstanbul)
  baseUrl: string
  riskler: RiskAlert[]
  odevler: HwRow[]
  kontrolEdilenIds: Set<string>
}

const gun = (iso: string) => format(parseISO(iso), 'd MMMM EEEE')
const odevSatiri = (h: HwRow, baseUrl: string) =>
  `<li><a href="${esc(baseUrl)}/odevler/${esc(h.id)}">${esc(h.title)}</a> <span class="k">· ${esc(h.classes?.name ?? '')} · ${esc(gun(h.due_date))}</span></li>`
const fazlasi = (n: number, ne: string) => (n > AZAMI ? `<li class="k">+${n - AZAMI} ${ne} daha</li>` : '')

export function haftalikOzetMaili(g: OzetGirdi): { subject: string; html: string } | null {
  // En ağır vakalar önce: aynı seviyede sıra rastgeleydi (canlı veride 94 öğrenciden 53'ü orta/yüksek — 2026-10-11)
  const takip = g.riskler.filter(r => r.riskLevel !== 'low')
    .sort((a, b) => (b.hwMisses + b.absences) - (a.hwMisses + a.absences))
  const bekleyen = g.odevler
    .filter(h => h.due_date < g.bugun && !g.kontrolEdilenIds.has(h.id))
    .sort((a, b) => b.due_date.localeCompare(a.due_date))
  const sonGun = addDaysISO(g.bugun, 6)
  const buHafta = g.odevler
    .filter(h => h.due_date >= g.bugun && h.due_date <= sonGun)
    .sort((a, b) => a.due_date.localeCompare(b.due_date))
  if (!takip.length && !bekleyen.length && !buHafta.length) return null

  const bolumler: string[] = []
  if (takip.length) bolumler.push(`<h3>Bu hafta takip etmen gereken öğrenciler</h3><ul>${
    takip.slice(0, AZAMI).map(r =>
      `<li><a href="${esc(g.baseUrl)}/siniflar/${esc(r.classId)}/ogrenciler/${esc(r.studentId)}">${esc(r.studentName)}</a> <span class="k">· ${esc(r.className)} · ${esc(r.reasons.join(', '))}</span></li>`).join('')
  }${takip.length > AZAMI ? `<li class="k">+${takip.length - AZAMI} öğrenci daha — <a href="${esc(g.baseUrl)}/anasayfa">ana sayfadaki Risk Uyarıları</a></li>` : ''}</ul>`)
  if (bekleyen.length) bolumler.push(`<h3>Kontrol bekleyen ödevler</h3><p class="k">Teslim tarihi geçti, henüz işaretlenmedi.</p><ul>${
    bekleyen.slice(0, AZAMI).map(h => odevSatiri(h, g.baseUrl)).join('')}${fazlasi(bekleyen.length, 'ödev')}</ul>`)
  if (buHafta.length) bolumler.push(`<h3>Bu hafta teslim alınacak ödevler</h3><ul>${
    buHafta.map(h => odevSatiri(h, g.baseUrl)).join('')}</ul>`)

  // Öğrenci sayısı konuda yok: kalabalık sınıfta "53 öğrenci" alarm gibi okunuyor
  const parca = [
    bekleyen.length && `${bekleyen.length} kontrol bekleyen ödev`,
    buHafta.length && `${buHafta.length} ödev bu hafta`,
  ].filter(Boolean)

  return {
    subject: parca.length ? `EduDesk haftalık özet: ${parca.join(', ')}` : 'EduDesk haftalık özet',
    html: `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
body{font-family:sans-serif;color:#1f2937;line-height:1.6}.box{max-width:560px;margin:0 auto;padding:24px}
h2{margin:0 0 4px}h3{margin:22px 0 6px;font-size:16px}ul{margin:0;padding-left:20px}li{margin:4px 0}
a{color:#1d4ed8}.k{color:#6b7280;font-size:14px}.btn{display:inline-block;background:#c8102e;color:#fff!important;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:22px}
</style></head><body><div class="box">
<h2>Günaydın, ${esc(g.ad)}</h2><p class="k">Bu haftanın kısa özeti.</p>
${bolumler.join('\n')}
<a class="btn" href="${esc(g.baseUrl)}/anasayfa">EduDesk'i aç</a>
<p class="k" style="font-size:11px;margin-top:24px">Bu e-postaları durdurmak için <a href="${esc(g.baseUrl)}/profil" style="color:#9ca3af">Profil → Bildirim Tercihleri</a>'nden e-posta bildirimini kapatabilirsiniz.</p>
</div></body></html>`,
  }
}
