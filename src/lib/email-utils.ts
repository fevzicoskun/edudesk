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

// Davetiye e-postası (yeni kullanıcı için giriş bilgileri)
export function buildInviteEmail(opts: {
  fullName:     string
  schoolName:   string
  email:        string
  tempPassword: string
}): string {
  const { fullName, schoolName, email, tempPassword } = opts
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>${BASE_CSS}
h2{margin:0 0 16px;color:#1f2937}
table{width:100%;border-collapse:collapse;margin:16px 0}
td{padding:8px;border-bottom:1px solid #e5e7eb}
td:first-child{color:#6b7280;width:40%}
.btn{display:inline-block;background:#10b981;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600}
.hint{color:#6b7280;font-size:14px}
</style></head>
<body><div class="box">
<h2>Hoş Geldiniz, ${esc(fullName)}!</h2>
<p><strong>${esc(schoolName)}</strong> için EduDesk hesabınız oluşturuldu.</p>
<table>
  <tr><td>E-posta</td><td><strong>${esc(email)}</strong></td></tr>
  <tr><td>Geçici Şifre</td><td><strong>${esc(tempPassword)}</strong></td></tr>
</table>
<p><a href="https://myedudesk.com.tr/login" class="btn">Giriş Yap</a></p>
<p class="hint">İlk girişden sonra şifrenizi değiştirmenizi öneririz.</p>
<div class="footer">EduDesk — Okul Takip Sistemi</div>
</div></body></html>`
}
