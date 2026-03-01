import { test, expect, waitForPageLoad } from './fixtures'

test.describe('Owner Journey (Demo)', () => {
  test('dashboard shows studio name, stat cards, quick actions, schedule, and feed', async ({ demoPage: page }) => {
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Empire Aerial Arts')

    // 4 stat cards in the top grid (Members, Upcoming Classes, Today's Classes, Check-ins Today)
    await expect(page.getByText('Members').first()).toBeVisible()
    await expect(page.getByText('Upcoming Classes')).toBeVisible()

    // Quick actions
    await expect(page.getByText(/quick actions/i)).toBeVisible()

    // Today's Schedule section
    await expect(page.getByText(/today.*schedule/i)).toBeVisible()

    // Community Feed section
    await expect(page.getByText(/community feed/i)).toBeVisible()
  })

  test('schedule page shows classes grouped by date with add-class button', async ({ demoPage: page }) => {
    await page.getByRole('link', { name: /schedule/i }).first().click()
    await waitForPageLoad(page)

    await expect(page).toHaveURL('/demo/schedule')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Schedule')
    await expect(page.getByRole('button', { name: /add class/i })).toBeVisible()

    // Classes exist with "with <teacher>" text
    await expect(page.getByText(/with /).first()).toBeVisible()
  })

  test('add class modal: select template, capacity auto-fills, cancel closes', async ({ demoPage: page }) => {
    await page.getByRole('link', { name: /schedule/i }).first().click()
    await waitForPageLoad(page)

    await page.getByRole('button', { name: /add class/i }).click()

    // Modal heading is visible
    const modalHeading = page.locator('h2').filter({ hasText: /add class/i })
    await expect(modalHeading).toBeVisible()

    // Template select exists
    const templateSelect = page.locator('select').first()
    await expect(templateSelect).toBeVisible()

    // Capacity field has a value (auto-filled from template)
    const capacityInput = page.locator('input[type="number"]')
    const capacityValue = await capacityInput.inputValue()
    expect(Number(capacityValue)).toBeGreaterThan(0)

    // Cancel closes modal
    await page.getByRole('button', { name: /^cancel$/i }).click()
    await expect(modalHeading).toBeHidden()
  })

  test('add class modal: submit adds new class to list', async ({ demoPage: page }) => {
    await page.getByRole('link', { name: /schedule/i }).first().click()
    await waitForPageLoad(page)

    // Count existing "with" lines (class entries)
    const classEntries = page.getByText(/with /)
    const countBefore = await classEntries.count()

    // Open modal and submit
    await page.getByRole('button', { name: /add class/i }).click()
    const modalHeading = page.locator('h2').filter({ hasText: /add class/i })
    await expect(modalHeading).toBeVisible()

    // Click "Add Class" button inside modal (not the top-level one)
    const modalButtons = page.locator('.relative').getByRole('button', { name: /add class/i })
    await modalButtons.click()

    // Modal closes
    await expect(modalHeading).toBeHidden()

    // New class appears — count increased
    await page.waitForTimeout(300)
    const countAfter = await page.getByText(/with /).count()
    expect(countAfter).toBeGreaterThan(countBefore)
  })

  test('class detail page shows heading, time, teacher, and tabs', async ({ demoPage: page }) => {
    await page.getByRole('link', { name: /schedule/i }).first().click()
    await waitForPageLoad(page)

    // Click first class link
    const firstClassLink = page.locator('a[href*="/demo/classes/"]').first()
    await firstClassLink.click()
    await waitForPageLoad(page)

    await expect(page).toHaveURL(/\/demo\/classes\//)

    // Back link
    await expect(page.getByText(/back to schedule/i)).toBeVisible()

    // Class heading
    const heading = page.getByRole('heading', { level: 1 })
    await expect(heading).toBeVisible()

    // Tabs: Roster, Check-in, Feed
    await expect(page.getByRole('tab', { name: /roster/i })).toBeVisible()
    await expect(page.getByRole('tab', { name: /check-in/i })).toBeVisible()
    await expect(page.getByRole('tab', { name: /feed/i })).toBeVisible()
  })

  test('members page: list with avatars, search filters results', async ({ demoPage: page }) => {
    await page.getByRole('link', { name: /members/i }).first().click()
    await waitForPageLoad(page)

    await expect(page).toHaveURL('/demo/members')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Members')

    // Members are listed (look for member names)
    await expect(page.getByText('Rabble', { exact: true })).toBeVisible()

    // Search for Kai
    await page.getByPlaceholder(/search members/i).fill('Kai')
    await page.waitForTimeout(300)

    // Kai should be visible, others hidden
    await expect(page.getByText('Kai', { exact: true }).first()).toBeVisible()
    // Rabble should be filtered out
    await expect(page.getByText('Rabble', { exact: true })).toBeHidden()
  })

  test('plans page: plan cards with prices and Create Plan button', async ({ demoPage: page }) => {
    await page.getByRole('link', { name: /plans/i }).first().click()
    await waitForPageLoad(page)

    await expect(page).toHaveURL('/demo/plans')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Membership Plans')
    await expect(page.getByRole('button', { name: /create plan/i })).toBeVisible()

    // Plan names visible
    await expect(page.getByText('Unlimited Monthly')).toBeVisible()
    // Prices visible
    await expect(page.getByText(/\$180/)).toBeVisible()
  })

  test('settings page: tabs switch correctly', async ({ demoPage: page }) => {
    await page.getByRole('link', { name: /settings/i }).first().click()
    await waitForPageLoad(page)

    await expect(page).toHaveURL('/demo/settings')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Settings')

    // Default tab: General
    await expect(page.getByText('Studio Details')).toBeVisible()

    // Switch to Notifications tab
    await page.getByRole('tab', { name: /notifications/i }).click()
    await expect(page.getByText('Notification Preferences')).toBeVisible()

    // Switch to Cancellation tab
    await page.getByRole('tab', { name: /cancellation/i }).click()
    await expect(page.getByText('Cancellation window')).toBeVisible()

    // Switch to Integrations tab
    await page.getByRole('tab', { name: /integrations/i }).click()
    await expect(page.getByText('Stripe')).toBeVisible()
  })
})
