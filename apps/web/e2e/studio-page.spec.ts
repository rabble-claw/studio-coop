import { test, expect, waitForPageLoad } from './fixtures'

test.describe('Studio public page', () => {
  test('shows schedule section with classes', async ({ demoPage: page }) => {
    // The demo dashboard acts as the studio page variant
    // Verify Today's Schedule section appears
    await expect(page.getByText("Today's Schedule")).toBeVisible()
  })

  test('shows plans section with pricing', async ({ demoPage: page }) => {
    // Navigate to plans — linked from the dashboard
    await page.getByRole('link', { name: /Plans/i }).first().click()
    await waitForPageLoad(page)

    // Verify at least one price is shown (contains $ or currency symbol)
    await expect(page.getByText(/\$/).first()).toBeVisible()
  })

  test('responsive: mobile viewport renders correctly', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 375, height: 667 },
    })
    const page = await context.newPage()
    await page.goto('/demo')
    await waitForPageLoad(page)

    // Studio name should still be visible
    await expect(page.getByRole('heading', { name: /Empire Aerial Arts/i })).toBeVisible()

    // Demo banner should be visible
    await expect(page.getByText("You're viewing the demo.")).toBeVisible()

    // Nav should still be accessible (might be scrollable)
    const nav = page.getByRole('navigation', { name: /Dashboard navigation/i })
    await expect(nav).toBeVisible()

    await context.close()
  })

  test('responsive: tablet viewport renders correctly', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 768, height: 1024 },
    })
    const page = await context.newPage()
    await page.goto('/demo')
    await waitForPageLoad(page)

    // Dashboard stat cards should be visible (use link role to target stat cards, not hidden nav labels)
    await expect(page.getByRole('link', { name: /Members \d+/ })).toBeVisible()
    await expect(page.getByRole('link', { name: /Upcoming Classes/ })).toBeVisible()

    await context.close()
  })
})
