import { defineConfig, devices } from '@playwright/test'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000'

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
    command: 'next dev --turbopack',  // turbopack: soğuk derleme ~5s vs webpack ~30-90s
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,                 // sunucu hazır olana kadar max 2 dak
  },
})
