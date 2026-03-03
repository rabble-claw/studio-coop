import { test, expect, waitForPageLoad } from './fixtures'

test.describe('Dashboard Money @auth', () => {
  test('plans tab shows seed plans with prices', async ({ ownerPage: page }) => {
    await page.getByRole('link', { name: /money/i }).first().click()
    await waitForPageLoad(page)

    // Plans tab is default — wait for data to load
    await expect(page.getByText('Unlimited Monthly')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(/\$180/)).toBeVisible()

    await expect(page.getByText('8-Class Pack')).toBeVisible()
    await expect(page.getByText(/\$160/)).toBeVisible()

    await expect(page.getByText('Drop-In')).toBeVisible()
    await expect(page.getByText(/\$25/)).toBeVisible()
  })

  test('plans tab shows Create Plan button', async ({ ownerPage: page }) => {
    await page.getByRole('link', { name: /money/i }).first().click()
    await waitForPageLoad(page)

    await expect(page.getByRole('button', { name: /create plan/i })).toBeVisible({ timeout: 15_000 })
  })

  test('coupons tab shows WELCOME20 + BRINGAFRIEND', async ({ ownerPage: page }) => {
    await page.getByRole('link', { name: /money/i }).first().click()
    await waitForPageLoad(page)

    // Switch to Coupons tab
    await page.getByRole('tab', { name: /Coupons/i }).click()

    // Wait for coupons to load
    await expect(page.getByText('WELCOME20')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText(/20% off/)).toBeVisible()

    await expect(page.getByText('BRINGAFRIEND')).toBeVisible()
    await expect(page.getByText(/1 free class/)).toBeVisible()
  })

  test('coupons tab shows Active status badges', async ({ ownerPage: page }) => {
    await page.getByRole('link', { name: /money/i }).first().click()
    await waitForPageLoad(page)

    await page.getByRole('tab', { name: /Coupons/i }).click()

    // Wait for coupon data to load
    await expect(page.getByText('WELCOME20')).toBeVisible({ timeout: 10_000 })

    // Active badge visible
    await expect(page.getByText('Active', { exact: true }).first()).toBeVisible()
  })

  test('coupons tab shows Create Coupon button', async ({ ownerPage: page }) => {
    await page.getByRole('link', { name: /money/i }).first().click()
    await waitForPageLoad(page)

    await page.getByRole('tab', { name: /Coupons/i }).click()

    await expect(page.getByRole('button', { name: /new coupon/i })).toBeVisible({ timeout: 10_000 })
  })

  test('all 4 money tabs switch correctly', async ({ ownerPage: page }) => {
    await page.getByRole('link', { name: /money/i }).first().click()
    await waitForPageLoad(page)

    const tabs = ['Plans', 'Coupons', 'Expenses', 'Instructors']
    for (const tab of tabs) {
      await page.getByRole('tab', { name: tab }).click()
      await expect(page.locator('[role="tabpanel"][data-state="active"]')).toBeVisible()
    }
  })

  test('expenses tab loads with content', async ({ ownerPage: page }) => {
    await page.getByRole('link', { name: /money/i }).first().click()
    await waitForPageLoad(page)

    await page.getByRole('tab', { name: /Expenses/i }).click()

    // Tab panel should be visible and have content
    const panel = page.locator('[role="tabpanel"][data-state="active"]')
    await expect(panel).toBeVisible({ timeout: 15_000 })
  })

  test('instructors tab shows content', async ({ ownerPage: page }) => {
    await page.getByRole('link', { name: /money/i }).first().click()
    await waitForPageLoad(page)

    await page.getByRole('tab', { name: /Instructors/i }).click()

    // Tab panel should be visible
    const panel = page.locator('[role="tabpanel"][data-state="active"]')
    await expect(panel).toBeVisible({ timeout: 15_000 })
  })
})
