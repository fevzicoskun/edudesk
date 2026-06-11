/**
 * Kritik hata e-posta bildirimleri için saf (pure) in-memory rate limiter.
 *
 * Tasarım:
 * - Parmak izi limiti: aynı hata parmak izi için pencere (varsayılan 1 saat)
 *   başına en fazla 1 e-posta.
 * - Global limit: tüm hatalar için pencere başına en fazla 5 e-posta
 *   (kayan pencere — son 1 saatteki gönderim zaman damgaları sayılır).
 * - `now` enjekte edilebilir (Date.now) → testlerde zaman ilerletilebilir.
 * - Hiçbir dış bağımlılık / yan etki yok → unit test edilebilir.
 */

const HOUR_MS = 60 * 60 * 1000

/**
 * Hata parmak izi: name + message'ın ilk 200 karakterinin FNV-1a hash'i.
 * Aynı hata (ör. aynı exception mesajı) her seferinde aynı parmak izini üretir.
 */
export function errorFingerprint(name: string, message: string): string {
  const input = `${name}:${message}`.slice(0, 200)
  let hash = 0x811c9dc5 // FNV-1a offset basis
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) // FNV prime
  }
  return (hash >>> 0).toString(16)
}

export interface AlertRateLimiterOptions {
  /** Pencere süresi (ms). Varsayılan: 1 saat. */
  windowMs?: number
  /** Pencere başına global e-posta limiti. Varsayılan: 5. */
  maxGlobalPerWindow?: number
  /** Zaman kaynağı — testlerde enjekte edilebilir. Varsayılan: Date.now. */
  now?: () => number
}

export class AlertRateLimiter {
  private readonly windowMs: number
  private readonly maxGlobalPerWindow: number
  private readonly now: () => number

  /** parmak izi → son gönderim zamanı */
  private lastSentByFingerprint = new Map<string, number>()
  /** Pencere içindeki tüm gönderim zaman damgaları (global limit için) */
  private sentTimestamps: number[] = []

  constructor(options: AlertRateLimiterOptions = {}) {
    this.windowMs           = options.windowMs ?? HOUR_MS
    this.maxGlobalPerWindow = options.maxGlobalPerWindow ?? 5
    this.now                = options.now ?? Date.now
  }

  /**
   * Bu parmak izi için şimdi e-posta gönderilebilir mi?
   * `true` dönerse gönderim "harcanmış" sayılır (kayıt atomik olarak yapılır).
   */
  tryAcquire(fingerprint: string): boolean {
    const t = this.now()

    // Pencere dışına düşen global gönderimleri temizle (kayan pencere)
    this.sentTimestamps = this.sentTimestamps.filter(ts => t - ts < this.windowMs)

    // 1) Parmak izi limiti: pencere içinde aynı hata için en fazla 1
    const lastSent = this.lastSentByFingerprint.get(fingerprint)
    if (lastSent !== undefined && t - lastSent < this.windowMs) return false

    // 2) Global limit: pencere içinde toplam en fazla maxGlobalPerWindow
    if (this.sentTimestamps.length >= this.maxGlobalPerWindow) return false

    this.lastSentByFingerprint.set(fingerprint, t)
    this.sentTimestamps.push(t)
    this.pruneFingerprints(t)
    return true
  }

  /** Bellek sızıntısını önle: süresi dolmuş parmak izi kayıtlarını sil. */
  private pruneFingerprints(t: number): void {
    if (this.lastSentByFingerprint.size <= 1000) return
    for (const [fp, ts] of this.lastSentByFingerprint) {
      if (t - ts >= this.windowMs) this.lastSentByFingerprint.delete(fp)
    }
  }
}
