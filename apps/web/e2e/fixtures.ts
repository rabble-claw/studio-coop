import { test as base, expect, type Page } from '@playwright/test'
import path from 'path'

/**
 * Wait for the page to finish loading — no loading spinners visible.
 */
async function waitForPageLoad(page: Page) {
  // Wait for network to settle
  await page.waitForLoadState('networkidle')
  // Ensure no generic loading spinners remain
  const spinners = page.locator('[aria-busy="true"], [role="progressbar"]')
  if ((await spinners.count()) > 0) {
    await expect(spinners.first()).toBeHidden({ timeout: 10_000 })
  }
}

type Fixtures = {
  demoPage: Page
  ownerPage: Page
  teacherPage: Page
  memberPage: Page
}

export const test = base.extend<Fixtures>({
  demoPage: async ({ page }, use) => {
    await page.goto('/demo')
    await waitForPageLoad(page)
    await use(page)
  },

  ownerPage: async ({ browser }, use) => {
    const authFile = path.join(__dirname, '.auth', 'owner.json')
    const context = await browser.newContext({ storageState: authFile })
    const page = await context.newPage()
    await page.goto('/dashboard')
    await waitForPageLoad(page)
    await use(page)
    await context.close()
  },

  teacherPage: async ({ browser }, use) => {
    const authFile = path.join(__dirname, '.auth', 'teacher.json')
    const context = await browser.newContext({ storageState: authFile })
    const page = await context.newPage()
    await page.goto('/dashboard')
    await waitForPageLoad(page)
    await use(page)
    await context.close()
  },

  memberPage: async ({ browser }, use) => {
    const authFile = path.join(__dirname, '.auth', 'member.json')
    const context = await browser.newContext({ storageState: authFile })
    const page = await context.newPage()
    await page.goto('/dashboard')
    await waitForPageLoad(page)
    await use(page)
    await context.close()
  },
})

export { expect, waitForPageLoad }
