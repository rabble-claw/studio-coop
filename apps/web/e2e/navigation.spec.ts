import { test, expect, waitForPageLoad } from './fixtures'

test.describe('Navigation and routing', () => {
  const navLinks = [
    { name: /Schedule/i, url: '/demo/schedule' },
    { name: /Members/i, url: '/demo/members' },
    { name: /Plans/i, url: '/demo/plans' },
    { name: /Feed/i, url: '/demo/feed' },
    { name: /Network/i, url: '/demo/network' },
    { name: /Coupons/i, url: '/demo/coupons' },
    { name: /Bookings/i, url: '/demo/private-bookings' },
    { name: /Reports/i, url: '/demo/reports' },
    { name: /Migrate/i, url: '/demo/migrate' },
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

    // Click the SC logo / Overview to go back
    await page.getByRole('link', { name: /Studio Co-op home/i }).click()
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

  test('404 page for invalid routes', async ({ page }) => {
    const response = await page.goto('/this-route-does-not-exist-xyz')
    // Next.js returns 404 status
    expect(response?.status()).toBe(404)
  })

  test('active nav item is highlighted on sub-routes', async ({ demoPage: page }) => {
    // Navigate to Members
    await page.getByRole('link', { name: /Members/i }).first().click()
    await waitForPageLoad(page)

    // The Members link should have aria-current="page"
    const membersLink = page.getByRole('link', { name: /Members/i }).first()
    await expect(membersLink).toHaveAttribute('aria-current', 'page')

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
})
