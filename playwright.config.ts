import { defineConfig, devices } from '@playwright/test'
import './tests/testEnv' // .env.local + doluysa .env.test (test Supabase projesi)

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000'
// E2E_SUNUCU=prod → build alıp production sunucusuna karşı koşar (dev'in soğuk derleme gürültüsü yok).
// Build burada alınır: NEXT_PUBLIC_* build'e gömülür, elle alınmış build canlı adresi taşıyabilir.
// Upstash yoksa login fail-closed olmasın diye RATE_LIMIT_FAIL_MODE=open (yalnız bu yerel sunucu).
const PROD = process.env.E2E_SUNUCU === 'prod'

export default defineConfig({
  testDir: './tests/playwright/e2e',
  timeout: 120_000,          // test başına max 2 dak — webpack/turbopack soğuk derleme için
  fullyParallel: false,      // rol bazlı testlerde sıra önemli
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,                // tek worker → session state çakışmalarını önler
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list'],
  ],

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    // 1) Auth state'leri oluştur (diğer projeler bunlara bağımlı)
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
    },
  ],

  globalSetup: './tests/playwright/setup/global-setup.ts',

  webServer: {
    command: PROD ? 'next build && next start' : 'next dev --webpack',    // turbopack bu Next sürümünde asılıp çöküyordu (2026-07-04, 52 test timeout) — npm run dev ile aynı mod
    env: PROD ? { RATE_LIMIT_FAIL_MODE: 'open' } : {},
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: PROD ? 600_000 : 120_000, // sunucu hazır olana kadar (prod: build dahil)
  },
})
