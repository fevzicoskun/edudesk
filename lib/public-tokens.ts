/**
 * HMAC-SHA256 signed tokens for public (unauthenticated) access to student/class data.
 * Token format: v1.{b64url_payload}.{b64url_hmac_sig}
 * Stateless — no DB lookup needed for verification.
 */

export type TokenType = 'veli' | 'yoklama' | 'tutanak'

interface TokenPayload {
  /** token type */
  t: TokenType
  /** primary entity UUID */
  id: string
  /** unix expiration timestamp */
  exp: number
  /** optional metadata (e.g. date for yoklama) */
  m?: Record<string, string>
}

function getSecret(): string {
  const secret = process.env.TOKEN_SECRET
  if (!secret || secret.length < 32) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('TOKEN_SECRET env var must be ≥32 characters in production')
    }
    return 'dev-fallback-secret-must-change-in-prod-min32'
  }
  return secret
}

async function importKey(secret: string): Promise<CryptoKey> {
  const keyData = new TextEncoder().encode(secret)
  return crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  )
}

/** base64url encode a string */
function strToB64url(s: string): string {
  return btoa(unescape(encodeURIComponent(s)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

/** base64url encode an ArrayBuffer */
function abToB64url(ab: ArrayBuffer): string {
  const bytes = new Uint8Array(ab)
  let binary = ''
  bytes.forEach(b => { binary += String.fromCharCode(b) })
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

/** base64url decode to Uint8Array backed by a plain ArrayBuffer (TypeScript 5.x compat) */
function b64urlToUint8(s: string): Uint8Array<ArrayBuffer> {
  const padded = s.replace(/-/g, '+').replace(/_/g, '/') + '=='.slice((s.length * 3) % 4 || 4)
  const binary = atob(padded)
  const ab = new ArrayBuffer(binary.length)
  const bytes = new Uint8Array(ab)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

/** base64url decode to UTF-8 string */
function b64urlToStr(s: string): string {
  const bytes = b64urlToUint8(s)
  return new TextDecoder().decode(bytes)
}

/**
 * Create a signed public-access token.
 * @param type    'veli' | 'yoklama' | 'tutanak'
 * @param id      Primary entity UUID
 * @param ttlDays Expiration in days (default 7)
 * @param meta    Optional extra data embedded in the token
 */
export async function createPublicToken(
  type: TokenType,
  id: string,
  ttlDays = 7,
  meta?: Record<string, string>
): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + ttlDays * 86400
  const payload: TokenPayload = { t: type, id, exp, ...(meta ? { m: meta } : {}) }
  const payloadB64 = strToB64url(JSON.stringify(payload))
  const message = `v1.${payloadB64}`

  const key = await importKey(getSecret())
  const sigAb = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message))

  return `${message}.${abToB64url(sigAb)}`
}

export type VerifyResult =
  | { ok: true; payload: TokenPayload }
  | { ok: false; reason: 'invalid_format' | 'bad_signature' | 'expired' | 'wrong_type' }

/**
 * Verify a token. Returns the payload on success, or an error reason on failure.
 * Never throws.
 */
export async function verifyPublicToken(
  token: string,
  expectedType: TokenType
): Promise<VerifyResult> {
  try {
    const parts = token.split('.')
    // format: v1 · payload · sig  (3 parts minimum)
    if (parts.length < 3 || parts[0] !== 'v1') {
      return { ok: false, reason: 'invalid_format' }
    }

    const sigB64 = parts[parts.length - 1]
    const message = parts.slice(0, -1).join('.')
    const payloadB64 = parts.slice(1, -1).join('.')

    const key = await importKey(getSecret())
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      b64urlToUint8(sigB64),
      new TextEncoder().encode(message)
    )
    if (!valid) return { ok: false, reason: 'bad_signature' }

    const payload: TokenPayload = JSON.parse(b64urlToStr(payloadB64))

    if (payload.t !== expectedType) return { ok: false, reason: 'wrong_type' }
    if (payload.exp < Math.floor(Date.now() / 1000)) return { ok: false, reason: 'expired' }

    return { ok: true, payload }
  } catch {
    return { ok: false, reason: 'invalid_format' }
  }
}

/** Returns true if the string looks like a v1 token (not a UUID) */
export function looksLikeToken(s: string): boolean {
  return s.startsWith('v1.')
}
