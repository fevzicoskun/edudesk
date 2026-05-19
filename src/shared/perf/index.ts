/**
 * Hafif query timing yardımcısı.
 *
 * Kullanım:
 *   const t = perfTimer()
 *   const { data } = await supabase.from('homeworks').select(...)
 *   t.log('anasayfa:homeworks')
 *
 * Kaldırmak için: tüm `perfTimer()` çağrılarını ve import'u silin.
 * Üretimde konsol çıktısı tamamen kapatılır.
 */

const IS_DEV = process.env.NODE_ENV !== 'production'
const WARN_MS = 500
const ERROR_MS = 2_000

export function perfTimer() {
  const start = Date.now()

  return {
    elapsed: () => Date.now() - start,

    log(label: string) {
      if (!IS_DEV) return
      const ms = Date.now() - start
      const prefix = ms >= ERROR_MS ? '🔴 SLOW' : ms >= WARN_MS ? '🟡 WARN' : '🟢'
      console.log(`[perf] ${prefix} ${label}: ${ms}ms`)
    },
  }
}

/** Birden fazla paralel sorguyu tek timer ile ölçer. */
export function perfGroup(groupLabel: string) {
  const start = Date.now()

  return {
    done() {
      if (!IS_DEV) return
      const ms = Date.now() - start
      const prefix = ms >= ERROR_MS ? '🔴 SLOW' : ms >= WARN_MS ? '🟡 WARN' : '🟢'
      console.log(`[perf] ${prefix} ${groupLabel} (group): ${ms}ms`)
    },
  }
}
