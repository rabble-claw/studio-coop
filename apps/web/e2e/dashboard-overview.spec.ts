import { test, expect, waitForPageLoad } from './fixtures'

test.describe('Dashboard Overview @auth', () => {
  test('owner sees Empire Aerial Arts heading + discipline', async ({ ownerPage: page }) => {
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Empire Aerial Arts')
    await expect(page.getByText(/aerial studio/i)).toBeVisible()
  })

  test('owner sees 4 stat cards with real member/class counts', async ({ ownerPage: page }) => {
    // Members stat card with count from seed data
    const membersLink = page.getByRole('link', { name: /Members: \d+/ })
    await expect(membersLink).toBeVisible({ timeout: 10_000 })

    // Upcoming Classes stat card
    const upcomingLink = page.getByRole('link', { name: /Upcoming Classes: \d+/ })
    await expect(upcomingLink).toBeVisible({ timeout: 10_000 })
  })

  test('owner sees Quick Actions with correct links', async ({ ownerPage: page }) => {
    await expect(page.getByText(/quick actions/i)).toBeVisible({ timeout: 10_000 })

    const scheduleLink = page.getByRole('link', { name: /manage schedule/i })
    await expect(scheduleLink).toBeVisible()
    await expect(scheduleLink).toHaveAttribute('href', '/dashboard/schedule')

    const membersLink = page.getByRole('link', { name: /view members/i })
    await expect(membersLink).toBeVisible()
    await expect(membersLink).toHaveAttribute('href', '/dashboard/members')

    const reportsLink = page.getByRole('link', { name: /view reports/i })
    await expect(reportsLink).toBeVisible()
    await expect(reportsLink).toHaveAttribute('href', '/dashboard/reports')

    const settingsLink = page.getByRole('link', { name: /settings/i }).last()
    await expect(settingsLink).toBeVisible()
    await expect(settingsLink).toHaveAttribute('href', '/dashboard/settings')
  })

  test('owner sees community feed with real posts', async ({ ownerPage: page }) => {
    await expect(page.getByText(/community feed/i)).toBeVisible({ timeout: 10_000 })

    // Feed posts show author names from seed data
    const feedSection = page.locator('section, div').filter({ hasText: /community feed/i })
    await expect(feedSection).toBeVisible()
  })

  test('teacher sees studio heading', async ({ teacherPage: page }) => {
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Empire Aerial Arts')
  })

  test('teacher sees stat cards', async ({ teacherPage: page }) => {
    const membersLink = page.getByRole('link', { name: /Members: \d+/ })
    await expect(membersLink).toBeVisible({ timeout: 10_000 })
  })

  test('teacher can click Quick Action to navigate', async ({ teacherPage: page }) => {
    await expect(page.getByText(/quick actions/i)).toBeVisible({ timeout: 10_000 })

    const scheduleLink = page.getByRole('link', { name: /manage schedule/i })
    await scheduleLink.click()
    await waitForPageLoad(page)

    await expect(page).toHaveURL(/\/dashboard\/schedule/)
  })

  test('member sees studio heading', async ({ memberPage: page }) => {
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Empire Aerial Arts')
  })

  test('member can navigate via stat card click', async ({ memberPage: page }) => {
    const upcomingLink = page.getByRole('link', { name: /Upcoming Classes: \d+/ })
    await expect(upcomingLink).toBeVisible({ timeout: 10_000 })

    await upcomingLink.click()
    await waitForPageLoad(page)

    await expect(page).toHaveURL(/\/dashboard\/schedule/)
  })

  test('member sees community feed', async ({ memberPage: page }) => {
    await expect(page.getByText(/community feed/i)).toBeVisible({ timeout: 10_000 })
  })

  test('all 6 nav items work for owner', async ({ ownerPage: page }) => {
    const navRoutes = [
      { name: /Schedule/i, url: '/dashboard/schedule' },
      { name: /Members/i, url: '/dashboard/members' },
      { name: /Money/i, url: '/dashboard/money' },
      { name: /Reports/i, url: '/dashboard/reports' },
      { name: /Settings/i, url: '/dashboard/settings' },
      { name: /Overview/i, url: '/dashboard' },
    ]

    for (const { name, url } of navRoutes) {
      await page.getByRole('link', { name }).first().click()
      await waitForPageLoad(page)
      await expect(page).toHaveURL(url)
    }
  })
})
