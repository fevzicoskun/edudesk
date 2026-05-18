/**
 * Playwright auth fixture — rol bazlı oturum context'leri sağlar.
 * Her test farklı bir rol ile çalışabilir.
 */
import { test as base, expect } from '@playwright/test'
import path from 'path'

const STORAGE_DIR = path.join(process.cwd(), 'tests/playwright/.auth')

/** Kullanılabilir roller */
type Role = 'ogretmen' | 'zumre_baskani' | 'mudur_yardimcisi' | 'mudur'

/** Auth state dosya yolu — global-setup.ts tarafından oluşturulur */
function authPath(role: Role): string {
  return path.join(STORAGE_DIR, `${role}.json`)
}

/** Rol bazlı test fixture'u — storageState ile hazır oturum */
export const test = base.extend<{
  ogretmenPage:         ReturnType<typeof base['extend']> extends never ? never : Parameters<typeof base>[0] extends object ? never : never
  asOgretmen:           void
  asMudur:              void
  asMudurYardimcisi:    void
}>({})

/** Belirli bir rolde giriş yapılmış sayfa döndüren yardımcı */
export function testAsRole(role: Role) {
  return base.extend({
    page: async ({ browser }, use) => {
      const context = await browser.newContext({
        storageState: authPath(role),
      })
      const page = await context.newPage()
      await use(page)
      await context.close()
    },
  })
}

export { expect }
