// Günlük Özet: saf format/tarih mantığı (DB'siz, test edilebilir).
// Spec: docs/superpowers/specs/2026-07-04-gunluk-ozet-design.md

export interface GunlukOzetInput {
  dersSatiri: string // formatOzetBody çıktısı, '' = bugün ders yok
  nobetSatirlari: string[] // formatDutyReminder çıktıları (öneksiz)
  eksikYoklamaSiniflari: string[] // dün yoklaması alınmamış mentor sınıf adları
  bugunTeslimOdevler: string[] // bugün teslim ödev başlıkları
  randevular: { period: number; studentName: string }[]
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

  for (const m of [...i.randevular].sort((a, b) => a.period - b.period)) {
    lines.push(`👤 Veli görüşmesi: ${m.period}. ders ${m.studentName}`)
  }

  if (!lines.length) return null
  const title = i.dersSatiri ? 'Bugünün dersleri' : i.nobetSatirlari.length ? 'Bugün nöbettesin' : 'Günlük özet'
  return { title, body: lines.join('\n') }
}
