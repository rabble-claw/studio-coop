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

  test('feed page shows posts with author avatars, content, and reaction buttons', async ({ demoPage: page }) => {
    await page.getByRole('link', { name: /feed/i }).first().click()
    await waitForPageLoad(page)

    await expect(page).toHaveURL('/demo/feed')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Community Feed')

    // Posts exist — author links
    const authorLinks = page.locator('a[href*="/demo/members/"]')
    expect(await authorLinks.count()).toBeGreaterThan(0)

    // Reaction buttons (heart, fire, clap emojis)
    const reactionButtons = page.locator('button').filter({ hasText: /[❤️🔥👏]/ })
    expect(await reactionButtons.count()).toBeGreaterThan(0)
  })

  test('feed reactions: click toggles visual state', async ({ demoPage: page }) => {
    await page.getByRole('link', { name: /feed/i }).first().click()
    await waitForPageLoad(page)

    // Find the first reaction button
    const reactionButton = page.locator('button').filter({ hasText: /[❤️🔥👏]/ }).first()
    await expect(reactionButton).toBeVisible()

    // Get initial class
    const initialClass = await reactionButton.getAttribute('class')

    // Click to toggle reaction
    await reactionButton.click()

    // Class should change (border/bg change indicates toggled state)
    const afterClass = await reactionButton.getAttribute('class')
    expect(afterClass).not.toEqual(initialClass)

    // Click again to untoggle
    await reactionButton.click()
    const revertedClass = await reactionButton.getAttribute('class')
    expect(revertedClass).toEqual(initialClass)
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
