import { test, expect, waitForPageLoad } from './fixtures'

test.describe('Teacher Journey (Demo)', () => {
  test('navigate to class detail from schedule', async ({ demoPage: page }) => {
    await page.getByRole('link', { name: /schedule/i }).first().click()
    await waitForPageLoad(page)

    // Click the first class link
    const firstClassLink = page.locator('a[href*="/demo/classes/"]').first()
    await expect(firstClassLink).toBeVisible()
    await firstClassLink.click()
    await waitForPageLoad(page)

    await expect(page).toHaveURL(/\/demo\/classes\//)
    // Class heading should be visible
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })

  test('roster tab shows booked members with status badges', async ({ demoPage: page }) => {
    await page.getByRole('link', { name: /schedule/i }).first().click()
    await waitForPageLoad(page)

    const firstClassLink = page.locator('a[href*="/demo/classes/"]').first()
    await firstClassLink.click()
    await waitForPageLoad(page)

    // Roster tab is selected by default
    await page.getByRole('tab', { name: /roster/i }).click()

    // Members and status badges visible in the roster
    await expect(page.getByText('Riley', { exact: true })).toBeVisible()
    await expect(page.getByText('Confirmed').first()).toBeVisible()
  })

  test('check-in tab: click member toggles check-in state', async ({ demoPage: page }) => {
    await page.getByRole('link', { name: /schedule/i }).first().click()
    await waitForPageLoad(page)

    const firstClassLink = page.locator('a[href*="/demo/classes/"]').first()
    await firstClassLink.click()
    await waitForPageLoad(page)

    // Switch to check-in tab
    await page.getByRole('tab', { name: /check-in/i }).click()

    // Find a check-in button (member circle in the grid)
    const memberButton = page.locator('button[title]').first()
    await expect(memberButton).toBeVisible({ timeout: 5_000 })

    // Get initial state of the circle
    const circle = memberButton.locator('.w-12')
    const classBefore = await circle.getAttribute('class')

    // Click to toggle check-in
    await memberButton.click()

    // Class should change (green ring toggles)
    const classAfter = await circle.getAttribute('class')
    expect(classAfter).not.toEqual(classBefore)
  })

  test('feed tab shows composer textarea and post button', async ({ demoPage: page }) => {
    await page.getByRole('link', { name: /schedule/i }).first().click()
    await waitForPageLoad(page)

    const firstClassLink = page.locator('a[href*="/demo/classes/"]').first()
    await firstClassLink.click()
    await waitForPageLoad(page)

    // Switch to feed tab
    await page.getByRole('tab', { name: /feed/i }).click()

    // Composer textarea
    await expect(page.getByPlaceholder(/write a post/i)).toBeVisible()

    // Post button
    await expect(page.getByRole('button', { name: /^post$/i })).toBeVisible()
  })

  test('back link returns to schedule', async ({ demoPage: page }) => {
    await page.getByRole('link', { name: /schedule/i }).first().click()
    await waitForPageLoad(page)

    const firstClassLink = page.locator('a[href*="/demo/classes/"]').first()
    await firstClassLink.click()
    await waitForPageLoad(page)

    // Click back link (uses &larr; which renders as ←)
    await page.getByText(/back to schedule/i).click()
    await waitForPageLoad(page)

    await expect(page).toHaveURL('/demo/schedule')
  })
})
