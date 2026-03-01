import { test, expect, waitForPageLoad } from './fixtures'

test.describe('Demo mode', () => {
  test('renders the demo dashboard with key sections', async ({ demoPage: page }) => {
    // Demo banner is visible
    await expect(page.getByText("You're viewing the demo.")).toBeVisible()

    // Studio name heading
    await expect(page.getByRole('heading', { name: /Empire Aerial Arts/i })).toBeVisible()

    // Stat cards
    await expect(page.getByText('Members').first()).toBeVisible()
    await expect(page.getByText('Upcoming Classes')).toBeVisible()

    // Quick Actions section
    await expect(page.getByText('Quick Actions')).toBeVisible()

    // Community Feed section
    await expect(page.getByText('Community Feed')).toBeVisible()
  })

  test('sidebar nav: Schedule page renders classes', async ({ demoPage: page }) => {
    await page.getByRole('link', { name: /Schedule/i }).first().click()
    await waitForPageLoad(page)

    await expect(page.getByRole('heading', { name: /Schedule/i })).toBeVisible()
    // Should show at least one class entry with "with <teacher>"
    await expect(page.getByText(/with /).first()).toBeVisible()
    // Add Class button
    await expect(page.getByRole('button', { name: /Add Class/i })).toBeVisible()
  })

  test('sidebar nav: Members page renders member list', async ({ demoPage: page }) => {
    await page.getByRole('link', { name: /Members/i }).first().click()
    await waitForPageLoad(page)

    await expect(page.getByRole('heading', { name: /Members/i })).toBeVisible()
    await expect(page.getByPlaceholder(/Search members/i)).toBeVisible()
    // At least one member card visible
    await expect(page.getByText(/owner|admin|teacher|member/i).first()).toBeVisible()
  })

  test('sidebar nav: Plans page renders plan cards', async ({ demoPage: page }) => {
    await page.getByRole('link', { name: /Plans/i }).first().click()
    await waitForPageLoad(page)

    await expect(page.getByRole('heading', { name: /Membership Plans/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Create Plan/i })).toBeVisible()
    // Plan names
    await expect(page.getByText(/Unlimited Monthly/i)).toBeVisible()
  })

  test('sidebar nav: Coupons page renders', async ({ demoPage: page }) => {
    await page.getByRole('link', { name: /Coupons/i }).first().click()
    await waitForPageLoad(page)

    await expect(page.getByRole('heading', { name: /Coupons/i })).toBeVisible()
  })

  test('sidebar nav: Reports page renders', async ({ demoPage: page }) => {
    await page.getByRole('link', { name: /Reports/i }).first().click()
    await waitForPageLoad(page)

    await expect(page.getByRole('heading', { name: /Reports/i })).toBeVisible()
  })

  test('sidebar nav: Settings page renders', async ({ demoPage: page }) => {
    await page.getByRole('link', { name: /Settings/i }).first().click()
    await waitForPageLoad(page)

    await expect(page.getByRole('heading', { name: /Settings/i })).toBeVisible()
  })

  test('Members page: click into member detail', async ({ demoPage: page }) => {
    await page.getByRole('link', { name: /Members/i }).first().click()
    await waitForPageLoad(page)

    // Click the first member card
    const firstMember = page.locator('a[href*="/demo/members/"]').first()
    await firstMember.click()
    await waitForPageLoad(page)

    // Should be on a member detail page
    await expect(page).toHaveURL(/\/demo\/members\//)
  })

  test('Schedule page: open Add Class modal', async ({ demoPage: page }) => {
    await page.getByRole('link', { name: /Schedule/i }).first().click()
    await waitForPageLoad(page)

    await page.getByRole('button', { name: /Add Class/i }).click()

    // Modal should be visible with form fields
    const modalHeading = page.locator('h2').filter({ hasText: /Add Class/i })
    await expect(modalHeading).toBeVisible()
    await expect(page.getByText(/Template/i)).toBeVisible()
    await expect(page.getByText(/Teacher/i)).toBeVisible()
    await expect(page.getByText(/Capacity/i)).toBeVisible()

    // Cancel closes the modal
    await page.getByRole('button', { name: /^Cancel$/i }).click()
    await expect(modalHeading).toBeHidden()
  })

  test('Notifications page: navigates from bell icon', async ({ demoPage: page }) => {
    await page.getByRole('link', { name: /Notifications/i }).click()
    await waitForPageLoad(page)

    await expect(page).toHaveURL(/\/demo\/notifications/)
  })
})
