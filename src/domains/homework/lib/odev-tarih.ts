/** Ödev tarih kuralları (YYYY-MM-DD, İstanbul günü). Ödevler sonradan da girilebilir
 *  (WhatsApp'tan geç görülen ödev): verildiği tarih geçmişte olabilir, gelecekte olamaz;
 *  son teslim verildiği tarihten önce olamaz. Hata yoksa null. */
export function odevTarihHatasi(verildigi: string, sonTeslim: string, bugun: string): string | null {
  if (verildigi > bugun) return 'Verildiği tarih gelecekte olamaz'
  if (sonTeslim < verildigi) return 'Son teslim tarihi, verildiği tarihten önce olamaz'
  return null
}
