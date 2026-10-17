// Günlük Özet: saf format/tarih mantığı (DB'siz, test edilebilir).
// Spec: docs/superpowers/specs/2026-07-04-gunluk-ozet-design.md
import { esc } from '@/src/lib/email-utils'
import { format, parseISO } from '@/src/shared/date'

export interface GunlukOzetInput {
  dersSatiri: string // formatOzetBody çıktısı, '' = bugün ders yok
  nobetSatirlari: string[] // formatDutyReminder çıktıları (öneksiz)
  eksikYoklamaSiniflari: string[] // dün yoklaması alınmamış mentor sınıf adları
  bugunTeslimOdevler: string[] // bugün teslim ödev başlıkları
}

// Önceki okul gününe kaç gün geri gidilir: Pazartesi(1) → 3 (Cuma), diğerleri → 1.
export function previousSchoolDayGap(dow: number): number {
  return dow === 1 ? 3 : 1
}

export function formatGunlukOzet(i: GunlukOzetInput): { title: string; body: string } | null {
  const lines: string[] = []

  if (i.dersSatiri) lines.push(i.dersSatiri)
  for (const n of i.nobetSatirlari) lines.push(`🔔 ${n}`)

  if (i.eksikYoklamaSiniflari.length === 1) {
    lines.push(`⚠️ Dün ${i.eksikYoklamaSiniflari[0]} yoklaması alınmadı`)
  } else if (i.eksikYoklamaSiniflari.length > 1) {
    lines.push(`⚠️ Dün ${i.eksikYoklamaSiniflari.length} sınıfın yoklaması alınmadı: ${i.eksikYoklamaSiniflari.join(', ')}`)
  }

  if (i.bugunTeslimOdevler.length === 1) {
    lines.push(`📚 Bugün teslim: "${i.bugunTeslimOdevler[0]}"`)
  } else if (i.bugunTeslimOdevler.length > 1) {
    lines.push(`📚 Bugün teslim: "${i.bugunTeslimOdevler[0]}" (+${i.bugunTeslimOdevler.length - 1} ödev)`)
  }

  if (!lines.length) return null
  const title = i.dersSatiri ? 'Bugünün dersleri' : i.nobetSatirlari.length ? 'Bugün nöbettesin' : 'Günlük özet'
  return { title, body: lines.join('\n') }
}

// Hafta içi sabah maili: ödev başına ayrı hatırlatma maili yerine tek mail (2026-10-17).
// Yalnız ders/nöbet varsa mail gitmez (her sabah aynı programı yollamak maili kapattırır); push/uygulama içi aynen sürer.
export type GunlukMailGirdi = Omit<GunlukOzetInput, 'bugunTeslimOdevler'> & {
  ad: string
  baseUrl: string
  bugunTeslim: { id: string; title: string; sinif: string; ogrenci: number }[]
  bekleyen: { id: string; title: string; sinif: string; dueDate: string }[] // teslimi geçmiş, hiç işaretlenmemiş
}

export function gunlukOzetMaili(g: GunlukMailGirdi): { subject: string; html: string } | null {
  if (!g.bugunTeslim.length && !g.bekleyen.length && !g.eksikYoklamaSiniflari.length) return null
  const u = esc(g.baseUrl)
  const link = (id: string, t: string) => `<a href="${u}/odevler/${esc(id)}">${esc(t)}</a>`
  const tr = (iso: string) => format(parseISO(iso), 'd MMMM EEEE')

  const bolum: string[] = []
  if (g.bugunTeslim.length) bolum.push(`<h3>Bugün teslim alınacak ödevler</h3><ul>${
    g.bugunTeslim.map(h => `<li>${link(h.id, h.title)} <span class="k">· ${esc(h.sinif)} · ${h.ogrenci} öğrenci</span></li>`).join('')}</ul>`)
  if (g.bekleyen.length) bolum.push(`<h3>İşaretlenmeyi bekleyen ödevler</h3><p class="k">Teslim tarihi geçti, henüz işaretlenmedi.</p><ul>${
    g.bekleyen.map(h => `<li>${link(h.id, h.title)} <span class="k">· ${esc(h.sinif)} · ${esc(tr(h.dueDate))}</span></li>`).join('')}</ul>`)
  if (g.eksikYoklamaSiniflari.length) bolum.push(`<h3>Alınmamış yoklama</h3><p>Önceki okul günü: ${esc(g.eksikYoklamaSiniflari.join(', '))}</p>`)
  const gun = [g.dersSatiri, ...g.nobetSatirlari.map(n => `🔔 ${n}`)].filter(Boolean)
  if (gun.length) bolum.push(`<h3>Bugün</h3>${gun.map(s => `<p>${esc(s)}</p>`).join('')}`)

  const parca = [
    g.bugunTeslim.length && `${g.bugunTeslim.length} ödev bugün teslim`,
    g.bekleyen.length && `${g.bekleyen.length} ödev işaretlenmedi`,
  ].filter(Boolean)

  return {
    subject: parca.length ? `EduDesk sabah özeti: ${parca.join(', ')}` : 'EduDesk sabah özeti',
    html: `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
body{font-family:sans-serif;color:#1f2937;line-height:1.6}.box{max-width:560px;margin:0 auto;padding:24px}
h2{margin:0 0 4px}h3{margin:22px 0 6px;font-size:16px}ul{margin:0;padding-left:20px}li{margin:4px 0}p{margin:4px 0}
a{color:#1d4ed8}.k{color:#6b7280;font-size:14px}
</style></head><body><div class="box">
<h2>Günaydın, ${esc(g.ad)}</h2>
${bolum.join('\n')}
<p class="k" style="font-size:11px;margin-top:24px">Bu e-postaları durdurmak için <a href="${u}/profil" style="color:#9ca3af">Profil → Bildirim Tercihleri</a>'nden e-posta bildirimini kapatabilirsiniz.</p>
</div></body></html>`,
  }
}
