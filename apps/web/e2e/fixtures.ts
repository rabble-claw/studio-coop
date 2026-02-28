import { test as base, expect, type Page } from '@playwright/test'

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
}

export const test = base.extend<Fixtures>({
  demoPage: async ({ page }, use) => {
    await page.goto('/demo')
    await waitForPageLoad(page)
    await use(page)
  },
})

export { expect, waitForPageLoad }
