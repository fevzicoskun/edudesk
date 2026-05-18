import { Redis } from '@upstash/redis'

let _redis: Redis | null = null

function getRedis(): Redis | null {
  if (_redis) return _redis
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) return null
  try {
    _redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
    return _redis
  } catch {
    return null
  }
}

const REVOKED_TTL = 30 * 24 * 60 * 60  // 30 days
const VALID_TTL   = 300                  // 5 minutes

function key(jti: string) {
  return `jti:revoked:${jti}`
}

/**
 * Fail-CLOSED: Redis miss + DB error → return true (reject token).
 * Cache: '1' = revoked, '0' = verified valid.
 */
export async function checkRevocation(
  jti: string,
  dbCheck: () => Promise<boolean>
): Promise<boolean> {
  const r = getRedis()

  if (r) {
    try {
      const cached = await r.get<string>(key(jti))
      if (cached === '1') return true
      if (cached === '0') return false
    } catch {
      // Redis read failed — fall through to DB
    }
  }

  let isRevoked: boolean
  try {
    isRevoked = await dbCheck()
  } catch {
    // Both Redis and DB failed — FAIL-CLOSED
    return true
  }

  if (r) {
    try {
      if (isRevoked) {
        await r.set(key(jti), '1', { ex: REVOKED_TTL })
      } else {
        await r.set(key(jti), '0', { ex: VALID_TTL })
      }
    } catch {
      // Non-fatal cache write failure
    }
  }

  return isRevoked
}

/**
 * Call immediately after writing to revoked_tokens table.
 * Populates Redis so subsequent checks skip the DB.
 */
export async function cacheRevocation(jti: string, expiresAt: string): Promise<void> {
  const r = getRedis()
  if (!r) return
  const ttlSec = Math.max(60, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000))
  try {
    await r.set(key(jti), '1', { ex: Math.min(ttlSec, REVOKED_TTL) })
  } catch {
    // Non-fatal
  }
}
