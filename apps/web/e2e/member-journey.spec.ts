import { test, expect, waitForPageLoad } from './fixtures'

test.describe('Member Journey (Demo)', () => {
  test('dashboard shows stat cards, today schedule, and community feed', async ({ demoPage: page }) => {
    // Stat cards
    await expect(page.getByText('Members').first()).toBeVisible()
    await expect(page.getByText('Upcoming Classes')).toBeVisible()

    // Today's Schedule
    await expect(page.getByText(/today.*schedule/i)).toBeVisible()

    // Community Feed
    await expect(page.getByText(/community feed/i)).toBeVisible()
  })

  test('community feed shows posts with author links and reactions', async ({ demoPage: page }) => {
    // Community Feed is on the Overview page
    await expect(page.getByText(/community feed/i)).toBeVisible()

    // Posts exist — author links within the feed section
    const authorLinks = page.locator('a[href*="/demo/members/"]')
    expect(await authorLinks.count()).toBeGreaterThan(0)

    // Reaction counts are visible (emoji + number)
    const reactions = page.getByText(/[❤️🔥👏]\s*\d+/)
    expect(await reactions.count()).toBeGreaterThan(0)
  })

  test('notifications page is accessible from bell icon', async ({ demoPage: page }) => {
    // The notification bell has aria-label="Notifications"
    const bellLink = page.getByRole('link', { name: /notifications/i })
    await expect(bellLink).toBeVisible()
    await bellLink.click()
    await waitForPageLoad(page)

    await expect(page).toHaveURL('/demo/notifications')
  })
})
