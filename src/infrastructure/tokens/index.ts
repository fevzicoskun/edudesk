/**
 * HMAC-SHA256 signed tokens for public (unauthenticated) access to student/class data.
 * Token format: v1.{b64url_payload}.{b64url_hmac_sig}
 * Stateless — payload contains jti for revocation support.
 */

import { logger } from '@/src/infrastructure/observability/logger'

export type TokenType = 'veli' | 'yoklama' | 'tutanak'

interface TokenPayload {
  t: TokenType
  id: string
  jti: string
  exp: number
  m?: Record<string, string>
}

function getSecret(): string {
  const secret = process.env.TOKEN_SECRET
  if (!secret || secret.length < 32) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('TOKEN_SECRET env var must be ≥32 characters in production')
    }
    logger.warn({ event: 'token_secret_missing' }, 'TOKEN_SECRET eksik veya kısa — dev fallback kullanılıyor')
    return 'dev-fallback-secret-must-change-in-prod-min32'
  }
  return secret
}

async function importKey(secret: string): Promise<CryptoKey> {
  const keyData = new TextEncoder().encode(secret)
  return crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])
}

function strToB64url(s: string): string {
  return btoa(unescape(encodeURIComponent(s)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function abToB64url(ab: ArrayBuffer): string {
  const bytes = new Uint8Array(ab)
  let binary = ''
  bytes.forEach(b => { binary += String.fromCharCode(b) })
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function b64urlToUint8(s: string): Uint8Array<ArrayBuffer> {
  const padded = s.replace(/-/g, '+').replace(/_/g, '/') + '=='.slice((s.length * 3) % 4 || 4)
  const binary = atob(padded)
  const ab = new ArrayBuffer(binary.length)
  const bytes = new Uint8Array(ab)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function b64urlToStr(s: string): string {
  return new TextDecoder().decode(b64urlToUint8(s))
}

function generateJti(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return abToB64url(bytes.buffer)
}

export async function createPublicToken(
  type: TokenType,
  id: string,
  ttlDays = 7,
  meta?: Record<string, string>
): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + ttlDays * 86400
  const jti = generateJti()
  const payload: TokenPayload = { t: type, id, jti, exp, ...(meta ? { m: meta } : {}) }
  const payloadB64 = strToB64url(JSON.stringify(payload))
  const message = `v1.${payloadB64}`

  const key = await importKey(getSecret())
  const sigAb = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message))

  return `${message}.${abToB64url(sigAb)}`
}

export function extractJti(token: string): string | null {
  try {
    const parts = token.split('.')
    if (parts.length < 3 || parts[0] !== 'v1') return null
    const payloadB64 = parts.slice(1, -1).join('.')
    const payload = JSON.parse(b64urlToStr(payloadB64)) as TokenPayload
    return payload.jti ?? null
  } catch {
    return null
  }
}

export type VerifyResult =
  | { ok: true; payload: TokenPayload }
  | { ok: false; reason: 'invalid_format' | 'bad_signature' | 'expired' | 'wrong_type' | 'revoked' }

export async function verifyPublicToken(
  token: string,
  expectedType: TokenType
): Promise<VerifyResult> {
  try {
    const parts = token.split('.')
    if (parts.length < 3 || parts[0] !== 'v1') {
      return { ok: false, reason: 'invalid_format' }
    }

    const sigB64 = parts[parts.length - 1]
    const message = parts.slice(0, -1).join('.')
    const payloadB64 = parts.slice(1, -1).join('.')

    const key = await importKey(getSecret())
    const valid = await crypto.subtle.verify(
      'HMAC', key,
      b64urlToUint8(sigB64),
      new TextEncoder().encode(message)
    )
    if (!valid) return { ok: false, reason: 'bad_signature' }

    const payload: TokenPayload = JSON.parse(b64urlToStr(payloadB64))
    if (!payload.t || !payload.id || typeof payload.exp !== 'number' || !payload.jti)
      return { ok: false, reason: 'invalid_format' }
    if (payload.t !== expectedType) return { ok: false, reason: 'wrong_type' }
    if (payload.exp < Math.floor(Date.now() / 1000)) return { ok: false, reason: 'expired' }

    return { ok: true, payload }
  } catch {
    return { ok: false, reason: 'invalid_format' }
  }
}

export async function isTokenRevoked(
  jti: string,
  supabase: { from: (t: string) => unknown }
): Promise<boolean> {
  const { checkRevocation } = await import('@/src/infrastructure/security/revocation')
  return checkRevocation(jti, async () => {
    type Q = { select: (c: string) => { eq: (c: string, v: string) => { maybeSingle: () => Promise<{ data: unknown; error: unknown }> } } }
    const { data, error } = await (supabase.from('revoked_tokens') as Q)
      .select('jti').eq('jti', jti).maybeSingle()
    if (error) throw error
    return data !== null
  })
}

export function looksLikeToken(s: string): boolean {
  return s.startsWith('v1.')
}
