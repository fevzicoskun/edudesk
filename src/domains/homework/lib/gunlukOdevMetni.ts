export type GunlukOdev = { sinif: string; ders: string; baslik: string; sonTeslim: string | null }

/** Bugün verilen ödevleri sınıf gruplu düz metne çevirir (WhatsApp/veli grubuna yapıştırmak için).
 *  Sınıf içindeki sıra korunur; sınıflar doğal sıralanır (9-A < 10-A). */
export function gunlukOdevMetni(odevler: GunlukOdev[]): string {
  const gruplar = new Map<string, string[]>()
  for (const o of odevler) {
    const teslim = o.sonTeslim ? ` (son teslim ${o.sonTeslim.slice(8, 10)}.${o.sonTeslim.slice(5, 7)})` : ''
    gruplar.set(o.sinif, [...(gruplar.get(o.sinif) ?? []), `• ${o.ders}: ${o.baslik}${teslim}`])
  }
  return [...gruplar.keys()]
    .sort((a, b) => a.localeCompare(b, 'tr', { numeric: true }))
    .map(s => `${s}\n${gruplar.get(s)!.join('\n')}`)
    .join('\n\n')
}
