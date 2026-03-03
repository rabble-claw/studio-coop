import { test, expect, waitForPageLoad } from './fixtures'

test.describe('Navigation and routing', () => {
  const navLinks = [
    { name: /Schedule/i, url: '/demo/schedule' },
    { name: /Members/i, url: '/demo/members' },
    { name: /Money/i, url: '/demo/money' },
    { name: /Reports/i, url: '/demo/reports' },
    { name: /Settings/i, url: '/demo/settings' },
  ]

  for (const { name, url } of navLinks) {
    test(`sidebar link "${name.source}" navigates to ${url}`, async ({ demoPage: page }) => {
      await page.getByRole('link', { name }).first().click()
      await waitForPageLoad(page)
      await expect(page).toHaveURL(url)
    })
  }

  test('Overview link navigates back to /demo', async ({ demoPage: page }) => {
    // Navigate away first
    await page.getByRole('link', { name: /Schedule/i }).first().click()
    await waitForPageLoad(page)
    await expect(page).toHaveURL('/demo/schedule')

    // Click Overview to go back
    await page.getByRole('link', { name: /Overview/i }).first().click()
    await waitForPageLoad(page)
    await expect(page).toHaveURL('/demo')
  })

  test('back navigation works', async ({ demoPage: page }) => {
    // Navigate to Members
    await page.getByRole('link', { name: /Members/i }).first().click()
    await waitForPageLoad(page)
    await expect(page).toHaveURL('/demo/members')

    // Navigate to a member detail
    const memberLink = page.locator('a[href*="/demo/members/"]').first()
    await memberLink.click()
    await waitForPageLoad(page)
    await expect(page).toHaveURL(/\/demo\/members\//)

    // Go back
    await page.goBack()
    await waitForPageLoad(page)
    await expect(page).toHaveURL('/demo/members')
  })

  test('active nav item is highlighted on sub-routes', async ({ demoPage: page }) => {
    // Navigate to Members
    await page.getByRole('link', { name: /Members/i }).first().click()
    await waitForPageLoad(page)

    // Navigate into a member detail
    const memberLink = page.locator('a[href*="/demo/members/"]').first()
    await memberLink.click()
    await waitForPageLoad(page)

    // Members nav item should still be active on the sub-route
    const membersNavLink = page
      .getByRole('navigation', { name: /Dashboard navigation/i })
      .getByRole('link', { name: /Members/i })
    await expect(membersNavLink).toHaveAttribute('aria-current', 'page')
  })

  test('Exit Demo button navigates to home', async ({ demoPage: page }) => {
    await page.getByRole('link', { name: /Exit Demo/i }).click()
    await waitForPageLoad(page)
    await expect(page).toHaveURL('/')
  })

  test('Money page tabs navigate between Plans, Coupons, Expenses, Instructors', async ({ demoPage: page }) => {
    await page.getByRole('link', { name: /Money/i }).first().click()
    await waitForPageLoad(page)

    // Plans tab (default)
    await expect(page.getByRole('tab', { name: /Plans/i })).toBeVisible()

    // Switch to Coupons
    await page.getByRole('tab', { name: /Coupons/i }).click()
    const activePanel = page.locator('[role="tabpanel"][data-state="active"]')
    await expect(activePanel).toBeVisible()

    // Switch to Expenses
    await page.getByRole('tab', { name: /Expenses/i }).click()
    await expect(page.locator('[role="tabpanel"][data-state="active"]')).toBeVisible()

    // Switch to Instructors
    await page.getByRole('tab', { name: /Instructors/i }).click()
    await expect(page.locator('[role="tabpanel"][data-state="active"]')).toBeVisible()
  })

  test('Reports page tabs navigate between all 6 report types', async ({ demoPage: page }) => {
    await page.getByRole('link', { name: /Reports/i }).first().click()
    await waitForPageLoad(page)

    const tabs = ['Attendance', 'Revenue', 'Popular Classes', 'Retention', 'P&L', 'Health']
    for (const tab of tabs) {
      await page.getByRole('tab', { name: tab }).click()
      await expect(page.locator('[role="tabpanel"][data-state="active"]')).toBeVisible()
    }
  })
})
