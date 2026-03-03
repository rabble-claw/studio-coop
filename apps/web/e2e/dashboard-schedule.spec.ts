import { test, expect, waitForPageLoad } from './fixtures'

test.describe('Dashboard Schedule @auth', () => {
  test('schedule shows heading + classes grouped by date', async ({ ownerPage: page }) => {
    await page.getByRole('link', { name: /schedule/i }).first().click()
    await waitForPageLoad(page)

    await expect(page.getByRole('heading', { level: 1 })).toContainText('Schedule')

    // Date headers (h2 elements with date text)
    const dateHeaders = page.locator('h2')
    expect(await dateHeaders.count()).toBeGreaterThan(0)

    // Class entries exist (cards with "with <teacher>" text)
    const classEntries = page.locator('a').filter({ hasText: /with/ })
    expect(await classEntries.count()).toBeGreaterThan(0)
  })

  test('seed class names visible (Pole, Aerial Hoop, etc.)', async ({ ownerPage: page }) => {
    await page.getByRole('link', { name: /schedule/i }).first().click()
    await waitForPageLoad(page)

    // At least 2 different template names from seed should be visible
    const classNames = ['Pole', 'Aerial Hoop', 'Aerial Silks', 'Handbalance', 'Flexibility', 'Hula Hoop']
    let found = 0
    for (const name of classNames) {
      const el = page.getByText(name, { exact: false }).first()
      if (await el.isVisible().catch(() => false)) found++
    }
    expect(found).toBeGreaterThanOrEqual(2)
  })

  test('capacity progress bars with booked/total counts', async ({ ownerPage: page }) => {
    await page.getByRole('link', { name: /schedule/i }).first().click()
    await waitForPageLoad(page)

    // Progress bars exist
    const progressBars = page.getByRole('progressbar')
    expect(await progressBars.count()).toBeGreaterThan(0)

    // Booked/capacity text like "4/12" or "6/15"
    await expect(page.getByText(/\d+\/\d+/).first()).toBeVisible()
  })

  test('tab switching between Schedule and Bookings', async ({ ownerPage: page }) => {
    await page.getByRole('link', { name: /schedule/i }).first().click()
    await waitForPageLoad(page)

    // Both tabs present
    const scheduleTab = page.getByRole('tab', { name: /Schedule/i })
    const bookingsTab = page.getByRole('tab', { name: /Bookings/i })
    await expect(scheduleTab).toBeVisible()
    await expect(bookingsTab).toBeVisible()

    // Switch to Bookings tab
    await bookingsTab.click()
    await expect(page.locator('[role="tabpanel"][data-state="active"]')).toBeVisible()

    // Switch back to Schedule
    await scheduleTab.click()
    await expect(page.locator('[role="tabpanel"][data-state="active"]')).toBeVisible()
  })

  test('teacher sees classes they teach', async ({ teacherPage: page }) => {
    await page.getByRole('link', { name: /schedule/i }).first().click()
    await waitForPageLoad(page)

    // At least one class with Jade's name
    await expect(page.getByText(/Jade/i).first()).toBeVisible({ timeout: 10_000 })
  })

  test('teacher sees Add Class button (staff privilege)', async ({ teacherPage: page }) => {
    await page.getByRole('link', { name: /schedule/i }).first().click()
    await waitForPageLoad(page)

    await expect(page.getByRole('button', { name: /add class/i })).toBeVisible()
  })

  test('clicking class link → class detail page', async ({ ownerPage: page }) => {
    await page.getByRole('link', { name: /schedule/i }).first().click()
    await waitForPageLoad(page)

    // Click first class link
    const firstClassLink = page.locator('a[href*="/dashboard/classes/"]').first()
    await expect(firstClassLink).toBeVisible({ timeout: 10_000 })
    await firstClassLink.click()
    await waitForPageLoad(page)

    await expect(page).toHaveURL(/\/dashboard\/classes\//)

    // Heading and back link
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByText(/back to schedule/i)).toBeVisible()
  })

  test('class detail shows Roster + Check-in tabs (staff)', async ({ ownerPage: page }) => {
    await page.getByRole('link', { name: /schedule/i }).first().click()
    await waitForPageLoad(page)

    const firstClassLink = page.locator('a[href*="/dashboard/classes/"]').first()
    await firstClassLink.click()
    await waitForPageLoad(page)

    await expect(page.getByRole('tab', { name: /roster/i })).toBeVisible()
    await expect(page.getByRole('tab', { name: /check-in/i })).toBeVisible()
  })

  test('member sees class detail without Check-in tab', async ({ memberPage: page }) => {
    await page.getByRole('link', { name: /schedule/i }).first().click()
    await waitForPageLoad(page)

    const firstClassLink = page.locator('a[href*="/dashboard/classes/"]').first()
    await expect(firstClassLink).toBeVisible({ timeout: 10_000 })
    await firstClassLink.click()
    await waitForPageLoad(page)

    // Roster tab visible for all roles
    await expect(page.getByRole('tab', { name: /roster/i })).toBeVisible()

    // Check-in tab should NOT be visible for members
    await expect(page.getByRole('tab', { name: /check-in/i })).toBeHidden()
  })

  test('class detail shows teacher name and time', async ({ ownerPage: page }) => {
    await page.getByRole('link', { name: /schedule/i }).first().click()
    await waitForPageLoad(page)

    const firstClassLink = page.locator('a[href*="/dashboard/classes/"]').first()
    await firstClassLink.click()
    await waitForPageLoad(page)

    // Teacher "with X" text
    await expect(page.getByText(/with /i).first()).toBeVisible()

    // Time range visible (e.g., "9:00 AM" or "09:00")
    await expect(page.getByText(/\d{1,2}:\d{2}/).first()).toBeVisible()
  })
})
