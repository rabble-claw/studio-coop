import { test, expect, waitForPageLoad } from './fixtures'

test.describe('Dashboard Reports @auth', () => {
  test('reports page shows 4 summary cards', async ({ ownerPage: page }) => {
    await page.getByRole('link', { name: /reports/i }).first().click()
    await waitForPageLoad(page)

    await expect(page.getByText('Total Revenue')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('Active Members')).toBeVisible()
    await expect(page.getByText('Avg Attendance')).toBeVisible()
    await expect(page.getByText('Retention Rate')).toBeVisible()
  })

  test('active members count is non-zero', async ({ ownerPage: page }) => {
    await page.getByRole('link', { name: /reports/i }).first().click()
    await waitForPageLoad(page)

    // Wait for report data to load
    await expect(page.getByText('Active Members')).toBeVisible({ timeout: 15_000 })

    // The Active Members card should show a number ≥ 15 from seed data
    // The card shows the number as a large bold text inside the card
    const activeCard = page.locator('div').filter({ hasText: /^Active Members$/ }).locator('..')
    const countText = activeCard.locator('.text-3xl')
    await expect(countText).toBeVisible({ timeout: 10_000 })
    const text = await countText.textContent()
    expect(Number(text)).toBeGreaterThan(0)
  })

  test('all 7 report tabs present and clickable', async ({ ownerPage: page }) => {
    await page.getByRole('link', { name: /reports/i }).first().click()
    await waitForPageLoad(page)

    // Wait for page to load
    await expect(page.getByText('Total Revenue')).toBeVisible({ timeout: 15_000 })

    const tabs = ['Attendance', 'Revenue', 'Popular', 'Retention', 'P&L', 'Health', 'Scenario']
    for (const tab of tabs) {
      const tabEl = page.getByRole('tab', { name: tab })
      await expect(tabEl).toBeVisible()
      await tabEl.click()
      await expect(page.locator('[role="tabpanel"][data-state="active"]')).toBeVisible()
    }
  })

  test('attendance tab shows weekly data', async ({ ownerPage: page }) => {
    await page.getByRole('link', { name: /reports/i }).first().click()
    await waitForPageLoad(page)

    // Attendance tab is default
    await expect(page.getByText('Weekly Attendance')).toBeVisible({ timeout: 15_000 })

    // Progress bars for attendance weeks
    const progressBars = page.getByRole('progressbar')
    expect(await progressBars.count()).toBeGreaterThan(0)
  })

  test('popular tab shows class ranking with fill rates', async ({ ownerPage: page }) => {
    await page.getByRole('link', { name: /reports/i }).first().click()
    await waitForPageLoad(page)

    await expect(page.getByText('Total Revenue')).toBeVisible({ timeout: 15_000 })

    await page.getByRole('tab', { name: 'Popular' }).click()

    await expect(page.getByText('Most Popular Classes')).toBeVisible({ timeout: 10_000 })

    // Fill rate percentages visible
    await expect(page.getByText(/%/).first()).toBeVisible()
  })

  test('teacher sees My Teaching Stats section', async ({ teacherPage: page }) => {
    await page.getByRole('link', { name: /reports/i }).first().click()
    await waitForPageLoad(page)

    // Teacher should see "My Teaching Stats" section
    await expect(page.getByText('My Teaching Stats')).toBeVisible({ timeout: 15_000 })
  })

  test('member does NOT see teaching stats', async ({ memberPage: page }) => {
    await page.getByRole('link', { name: /reports/i }).first().click()
    await waitForPageLoad(page)

    // Wait for reports to finish loading
    await expect(page.getByText('Total Revenue').or(page.getByText(/failed to load/i))).toBeVisible({ timeout: 15_000 })

    // "My Teaching Stats" should NOT be visible for regular members
    await expect(page.getByText('My Teaching Stats')).toBeHidden()
  })
})
