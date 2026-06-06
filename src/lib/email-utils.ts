export const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

// Türkiye saatine göre ISO tarih dizisi (YYYY-MM-DD). İsteğe bağlı Date parametresiyle ileriki/geçmiş günler de hesaplanabilir.
export function turkeyDate(d = new Date()): string {
  return new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Istanbul' }).format(d)
}

export function formatDateTR(isoDate: string): string {
  try {
    return new Intl.DateTimeFormat('tr-TR', {
      day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Istanbul',
    }).format(new Date(isoDate + 'T12:00:00'))
  } catch { return isoDate }
}

const BASE_CSS = `body{font-family:sans-serif;color:#1f2937;line-height:1.6}
.box{max-width:520px;margin:32px auto;padding:32px;border:1px solid #e5e7eb;border-radius:12px}
.badge-blue{display:inline-block;background:#eff6ff;color:#1d4ed8;padding:4px 10px;border-radius:6px;font-size:13px;font-weight:600}
.badge-amber{display:inline-block;background:#fef3c7;color:#92400e;padding:4px 10px;border-radius:6px;font-size:13px;font-weight:600}
.footer{margin-top:24px;padding-top:16px;border-top:1px solid #f3f4f6;font-size:12px;color:#9ca3af}`

// Ödev hatırlatma e-postası (teslim tarihi yaklaşmış / öğretmen manüel gönderdi)
export function buildReminderEmail(opts: {
  veliAd: string
  ogrenciAdi: string
  odevBaslik: string
  dueDateStr: string  // '' ise tarih satırı gösterilmez
}): string {
  const { veliAd, ogrenciAdi, odevBaslik, dueDateStr } = opts
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>${BASE_CSS}</style></head>
<body><div class="box">
<p>${esc(veliAd)},</p>
<p><strong>${esc(ogrenciAdi)}</strong> adlı öğrencinizin</p>
<p class="badge-blue">"${esc(odevBaslik)}"</p>
<p>adlı ödevi${dueDateStr ? ` <strong>${esc(dueDateStr)}</strong> tarihinde` : ''} teslim edilmesi gerekmektedir.</p>
<p>Lütfen ödevin tamamlandığından emin olunuz.</p>
<div class="footer">EduDesk — Okul Takip Sistemi</div>
</div></body></html>`
}

// Ödev teslim edilmedi bildirimi (teslim tarihi geçmiş, otomatik gönderim)
export function buildMissedEmail(opts: {
  veliAd: string
  ogrenciAdi: string
  odevBaslik: string
  dueDateStr: string
}): string {
  const { veliAd, ogrenciAdi, odevBaslik, dueDateStr } = opts
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>${BASE_CSS}</style></head>
<body><div class="box">
<p>${esc(veliAd)},</p>
<p><strong>${esc(ogrenciAdi)}</strong> adlı öğrencinizin</p>
<p class="badge-amber">"${esc(odevBaslik)}"</p>
<p>adlı ödevi <strong>${esc(dueDateStr)}</strong> teslim tarihini geçmiş olup henüz teslim edilmemiştir.</p>
<p>Lütfen öğrencinizi bilgilendirmenizi rica ederiz.</p>
<div class="footer">EduDesk — Okul Takip Sistemi</div>
</div></body></html>`
}
