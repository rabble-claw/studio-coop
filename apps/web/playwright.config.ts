import { defineConfig, devices } from '@playwright/test'
import { config } from 'dotenv'
import path from 'path'

// Load env from monorepo root (Supabase URL, service role key, etc.)
config({ path: path.resolve(__dirname, '../../.env.local') })

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'line' : 'html',
  timeout: 30_000,
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'demo',
      use: { ...devices['Desktop Chrome'] },
      grepInvert: /@auth/,
      testIgnore: /global-setup/,
    },
    {
      name: 'authenticated',
      use: { ...devices['Desktop Chrome'] },
      grep: /@auth/,
      testIgnore: /global-setup/,
    },
  ],
  webServer: [
    {
      command: 'pnpm dev',
      url: 'http://localhost:3000',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: 'pnpm --filter api dev',
      url: 'http://localhost:3001/health',
      cwd: path.resolve(__dirname, '../..'),
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
})
