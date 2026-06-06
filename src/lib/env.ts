import 'server-only'
import { z } from 'zod'

const schema = z.object({
  // ── Supabase (zorunlu) ────────────────────────────────────────────────────
  NEXT_PUBLIC_SUPABASE_URL:             z.string().url('NEXT_PUBLIC_SUPABASE_URL geçerli bir URL olmalı'),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1, 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY eksik'),
  SUPABASE_SERVICE_ROLE_KEY:            z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY eksik'),

  // ── Güvenlik (zorunlu) ───────────────────────────────────────────────────
  TOKEN_SECRET: z.string().min(32, 'TOKEN_SECRET en az 32 karakter olmalı'),

  // ── Uygulama URL (varsayılan var) ─────────────────────────────────────────
  NEXT_PUBLIC_APP_URL: z.string().url().default('https://myedudesk.com.tr'),

  // ── E-posta / Resend (opsiyonel — eksikse mail gönderilemez, app çalışır) ─
  RESEND_API_KEY: z.string().default(''),
  RESEND_FROM:    z.string().default('EduDesk <noreply@myedudesk.com.tr>'),
  FEEDBACK_TO:    z.string().default(''),

  // ── Loglama ───────────────────────────────────────────────────────────────
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  // ── Rate limiting ─────────────────────────────────────────────────────────
  RATE_LIMIT_FAIL_MODE: z.enum(['open', 'closed']).default('closed'),

  // ── Unsubscribe token signing ─────────────────────────────────────────────
  UNSUBSCRIBE_SECRET: z.string().default(''),
})

const parsed = schema.safeParse(process.env)

if (!parsed.success) {
  const issues = parsed.error.issues
    .map(i => `  • ${i.path.join('.')}: ${i.message}`)
    .join('\n')
  throw new Error(
    `[EduDesk] Zorunlu ortam değişkenleri eksik veya geçersiz:\n${issues}\n\n` +
    '.env.example dosyasını inceleyip .env.local oluşturun.'
  )
}

export const env = parsed.data
