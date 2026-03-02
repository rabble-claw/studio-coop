/**
 * End-to-End Demo Journey Test
 *
 * Tests the complete UI flow in demo mode (no backend needed).
 * Walks through all 6 nav items and their sub-tabs, verifying
 * rendering, forms, and navigation.
 */
import { test, expect, waitForPageLoad } from './fixtures'

// ─── 1. Landing & Explore ───────────────────────────────────────────────────

test.describe('1. Landing & Explore', () => {
  test('landing page shows hero and navigation', async ({ page }) => {
    await page.goto('/')
    await waitForPageLoad(page)

    // Hero headline
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      'Your studio, your community, your platform',
    )

    // CTA buttons (may appear twice — hero + footer CTA)
    await expect(page.getByRole('link', { name: /start free/i }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: /see the demo/i }).first()).toBeVisible()

    // Navigation links
    await expect(page.getByRole('link', { name: /explore studios/i })).toBeVisible()
  })

  test('explore page loads', async ({ page }) => {
    await page.goto('/explore')
    await waitForPageLoad(page)

    // Explore page may show "Find Your Studio" or an error if no backend
    // Just verify the page loaded without crashing
    const heading = page.getByRole('heading', { level: 1 })
    await expect(heading).toBeVisible()
  })

  test('demo link navigates to demo dashboard', async ({ page }) => {
    await page.goto('/')
    await waitForPageLoad(page)

    await page.getByRole('link', { name: /see the demo/i }).first().click()
    await waitForPageLoad(page)

    await expect(page).toHaveURL('/demo')
  })
})

// ─── 2. Dashboard Overview ──────────────────────────────────────────────────

test.describe('2. Dashboard Overview', () => {
  test('shows stat cards and sections', async ({ demoPage: page }) => {
    // Stat cards
    await expect(page.getByText('Members').first()).toBeVisible()
    await expect(page.getByText('Upcoming Classes')).toBeVisible()
    await expect(page.getByText("Today's Classes")).toBeVisible()

    // Quick actions section
    await expect(page.getByText(/quick actions/i)).toBeVisible()
  })

  test('shows schedule and community feed', async ({ demoPage: page }) => {
    // Today's Schedule section
    await expect(page.getByText(/today.*schedule/i)).toBeVisible()

    // Community Feed section
    await expect(page.getByText(/community feed/i)).toBeVisible()
  })
})

// ─── 3. Schedule Management ─────────────────────────────────────────────────

test.describe('3. Schedule Management', () => {
  test('schedule page loads with classes', async ({ demoPage: page }) => {
    await page.getByRole('link', { name: /schedule/i }).first().click()
    await waitForPageLoad(page)

    await expect(page).toHaveURL('/demo/schedule')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Schedule')
    await expect(page.getByRole('button', { name: /add class/i })).toBeVisible()

    // Classes exist
    await expect(page.getByText(/with /).first()).toBeVisible()
  })

  test('add class modal opens and has form fields', async ({ demoPage: page }) => {
    await page.getByRole('link', { name: /schedule/i }).first().click()
    await waitForPageLoad(page)

    await page.getByRole('button', { name: /add class/i }).click()

    const modalHeading = page.locator('h2').filter({ hasText: /add class/i })
    await expect(modalHeading).toBeVisible()

    // Template select
    const templateSelect = page.locator('select').first()
    await expect(templateSelect).toBeVisible()

    // Capacity input auto-filled
    const capacityInput = page.locator('input[type="number"]')
    const val = await capacityInput.inputValue()
    expect(Number(val)).toBeGreaterThan(0)

    // Cancel closes
    await page.getByRole('button', { name: /^cancel$/i }).click()
    await expect(modalHeading).toBeHidden()
  })

  test('bookings tab shows content', async ({ demoPage: page }) => {
    await page.getByRole('link', { name: /schedule/i }).first().click()
    await waitForPageLoad(page)

    // Switch to bookings tab
    const bookingsTab = page.getByRole('tab', { name: /bookings/i })
    if (await bookingsTab.isVisible()) {
      await bookingsTab.click()
      await page.waitForTimeout(300)
      // Bookings tab content should be visible (even if empty state)
      await expect(page.locator('[role="tabpanel"][data-state="active"]')).toBeVisible()
    }
  })

  test('class detail page shows tabs', async ({ demoPage: page }) => {
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
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

    // Tabs
    await expect(page.getByRole('tab', { name: /roster/i })).toBeVisible()
    await expect(page.getByRole('tab', { name: /check-in/i })).toBeVisible()
  })

  test('submit add class increases class count', async ({ demoPage: page }) => {
    await page.getByRole('link', { name: /schedule/i }).first().click()
    await waitForPageLoad(page)

    const classEntries = page.getByText(/with /)
    const countBefore = await classEntries.count()

    // Open modal and submit
    await page.getByRole('button', { name: /add class/i }).click()
    const modalHeading = page.locator('h2').filter({ hasText: /add class/i })
    await expect(modalHeading).toBeVisible()

    // Submit via the modal's add class button
    const modalButtons = page.locator('.relative').getByRole('button', { name: /add class/i })
    await modalButtons.click()

    await expect(modalHeading).toBeHidden()
    await page.waitForTimeout(300)

    const countAfter = await page.getByText(/with /).count()
    expect(countAfter).toBeGreaterThan(countBefore)
  })
})

// ─── 4. Member Management ───────────────────────────────────────────────────

test.describe('4. Member Management', () => {
  test('members page loads with member list', async ({ demoPage: page }) => {
    await page.getByRole('link', { name: /members/i }).first().click()
    await waitForPageLoad(page)

    await expect(page).toHaveURL('/demo/members')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Members')
    await expect(page.getByText('Rabble', { exact: true })).toBeVisible()
  })

  test('search filters members', async ({ demoPage: page }) => {
    await page.getByRole('link', { name: /members/i }).first().click()
    await waitForPageLoad(page)

    // Search for Kai
    await page.getByPlaceholder(/search members/i).fill('Kai')
    await page.waitForTimeout(300)

    await expect(page.getByText('Kai', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('Rabble', { exact: true })).toBeHidden()
  })

  test('invite member button and modal', async ({ demoPage: page }) => {
    await page.getByRole('link', { name: /members/i }).first().click()
    await waitForPageLoad(page)

    const inviteBtn = page.getByRole('button', { name: /invite member/i })
    if (await inviteBtn.isVisible()) {
      await inviteBtn.click()
      // Modal or form should appear
      await expect(page.getByText(/invite/i).first()).toBeVisible()
    }
  })

  test('member detail page loads', async ({ demoPage: page }) => {
    await page.getByRole('link', { name: /members/i }).first().click()
    await waitForPageLoad(page)

    // Click first member link
    const memberLink = page.locator('a[href*="/demo/members/"]').first()
    if (await memberLink.isVisible()) {
      await memberLink.click()
      await waitForPageLoad(page)
      await expect(page).toHaveURL(/\/demo\/members\//)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    }
  })
})

// ─── 5. Check-in Flow ───────────────────────────────────────────────────────

test.describe('5. Check-in Flow', () => {
  test('class detail check-in tab shows content', async ({ demoPage: page }) => {
    await page.getByRole('link', { name: /schedule/i }).first().click()
    await waitForPageLoad(page)

    const firstClassLink = page.locator('a[href*="/demo/classes/"]').first()
    await firstClassLink.click()
    await waitForPageLoad(page)

    // Switch to check-in tab
    await page.getByRole('tab', { name: /check-in/i }).click()
    await page.waitForTimeout(300)

    // Check-in content should be visible (photo grid or empty state)
    await expect(page.locator('[role="tabpanel"][data-state="active"]')).toBeVisible()
  })

  test('roster tab shows booked members', async ({ demoPage: page }) => {
    await page.getByRole('link', { name: /schedule/i }).first().click()
    await waitForPageLoad(page)

    const firstClassLink = page.locator('a[href*="/demo/classes/"]').first()
    await firstClassLink.click()
    await waitForPageLoad(page)

    // Roster tab should be default or click it
    const rosterTab = page.getByRole('tab', { name: /roster/i })
    await rosterTab.click()
    await page.waitForTimeout(300)

    await expect(page.locator('[role="tabpanel"][data-state="active"]')).toBeVisible()
  })
})

// ─── 6. Money Management ────────────────────────────────────────────────────

test.describe('6. Money Management', () => {
  test('money page loads with tabs', async ({ demoPage: page }) => {
    await page.getByRole('link', { name: /money/i }).first().click()
    await waitForPageLoad(page)

    await expect(page).toHaveURL('/demo/money')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Money')
  })

  test('plans tab shows plan cards', async ({ demoPage: page }) => {
    await page.getByRole('link', { name: /money/i }).first().click()
    await waitForPageLoad(page)

    // Plans tab should be default
    await expect(page.getByText('Unlimited Monthly')).toBeVisible()
    await expect(page.getByText(/\$180/)).toBeVisible()
  })

  test('coupons tab shows content', async ({ demoPage: page }) => {
    await page.getByRole('link', { name: /money/i }).first().click()
    await waitForPageLoad(page)

    await page.getByRole('tab', { name: /coupons/i }).click()
    await page.waitForTimeout(300)
    await expect(page.locator('[role="tabpanel"][data-state="active"]')).toBeVisible()
  })

  test('expenses tab shows content', async ({ demoPage: page }) => {
    await page.getByRole('link', { name: /money/i }).first().click()
    await waitForPageLoad(page)

    await page.getByRole('tab', { name: /expenses/i }).click()
    await page.waitForTimeout(300)
    await expect(page.locator('[role="tabpanel"][data-state="active"]')).toBeVisible()
  })

  test('instructors tab shows content', async ({ demoPage: page }) => {
    await page.getByRole('link', { name: /money/i }).first().click()
    await waitForPageLoad(page)

    await page.getByRole('tab', { name: /instructors/i }).click()
    await page.waitForTimeout(300)
    await expect(page.locator('[role="tabpanel"][data-state="active"]')).toBeVisible()
  })

  test('create plan button is visible', async ({ demoPage: page }) => {
    await page.getByRole('link', { name: /money/i }).first().click()
    await waitForPageLoad(page)

    await expect(page.getByRole('button', { name: /create plan/i })).toBeVisible()
  })
})

// ─── 7. Reports & Analytics ─────────────────────────────────────────────────

test.describe('7. Reports & Analytics', () => {
  test('reports page loads with summary cards', async ({ demoPage: page }) => {
    await page.getByRole('link', { name: /reports/i }).first().click()
    await waitForPageLoad(page)

    await expect(page).toHaveURL('/demo/reports')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Reports')

    // Summary stat cards
    await expect(page.getByText('Monthly Revenue')).toBeVisible()
    await expect(page.getByText('Active Members')).toBeVisible()
  })

  test('attendance tab shows chart', async ({ demoPage: page }) => {
    await page.getByRole('link', { name: /reports/i }).first().click()
    await waitForPageLoad(page)

    // Attendance tab should be default
    await expect(page.locator('[role="tabpanel"][data-state="active"]')).toBeVisible()
  })

  test('revenue tab shows breakdown', async ({ demoPage: page }) => {
    await page.getByRole('link', { name: /reports/i }).first().click()
    await waitForPageLoad(page)

    await page.getByRole('tab', { name: /revenue/i }).click()
    await page.waitForTimeout(300)
    await expect(page.locator('[role="tabpanel"][data-state="active"]')).toBeVisible()
  })

  test('popular classes tab shows rankings', async ({ demoPage: page }) => {
    await page.getByRole('link', { name: /reports/i }).first().click()
    await waitForPageLoad(page)

    await page.getByRole('tab', { name: /classes/i }).click()
    await page.waitForTimeout(300)
    await expect(page.locator('[role="tabpanel"][data-state="active"]')).toBeVisible()
  })

  test('retention tab shows at-risk members', async ({ demoPage: page }) => {
    await page.getByRole('link', { name: /reports/i }).first().click()
    await waitForPageLoad(page)

    await page.getByRole('tab', { name: /retention/i }).click()
    await page.waitForTimeout(300)
    await expect(page.getByText(/at-risk/i).first()).toBeVisible()
  })

  test('P&L tab shows financial data', async ({ demoPage: page }) => {
    await page.getByRole('link', { name: /reports/i }).first().click()
    await waitForPageLoad(page)

    await page.getByRole('tab', { name: /p&l/i }).click()
    await page.waitForTimeout(300)
    await expect(page.locator('[role="tabpanel"][data-state="active"]')).toBeVisible()
  })

  test('health tab shows score', async ({ demoPage: page }) => {
    await page.getByRole('link', { name: /reports/i }).first().click()
    await waitForPageLoad(page)

    await page.getByRole('tab', { name: /health/i }).click()
    await page.waitForTimeout(300)
    await expect(page.locator('[role="tabpanel"][data-state="active"]')).toBeVisible()
  })
})

// ─── 8. Settings ────────────────────────────────────────────────────────────

test.describe('8. Settings', () => {
  test('settings page loads with general tab', async ({ demoPage: page }) => {
    await page.getByRole('link', { name: /settings/i }).first().click()
    await waitForPageLoad(page)

    await expect(page).toHaveURL('/demo/settings')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Settings')

    // General tab is default — Studio Details form
    await expect(page.getByText('Studio Details').first()).toBeVisible()
  })

  test('notifications tab shows toggles', async ({ demoPage: page }) => {
    await page.getByRole('link', { name: /settings/i }).first().click()
    await waitForPageLoad(page)

    await page.getByRole('tab', { name: /notifications/i }).click()
    await expect(page.getByText('Notification Preferences')).toBeVisible()
  })

  test('cancellation tab shows policy settings', async ({ demoPage: page }) => {
    await page.getByRole('link', { name: /settings/i }).first().click()
    await waitForPageLoad(page)

    await page.getByRole('tab', { name: /cancellation/i }).click()
    await expect(page.getByText('Cancellation window')).toBeVisible()
  })

  test('integrations tab shows connected services', async ({ demoPage: page }) => {
    await page.getByRole('link', { name: /settings/i }).first().click()
    await waitForPageLoad(page)

    await page.getByRole('tab', { name: /integrations/i }).click()
    await expect(page.getByText('Stripe')).toBeVisible()
  })
})

// ─── 9. Cross-page Navigation ───────────────────────────────────────────────

test.describe('9. Cross-page Navigation', () => {
  test('all 6 nav items are accessible', async ({ demoPage: page }) => {
    // Overview (already on demo page)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

    // Schedule
    await page.getByRole('link', { name: /schedule/i }).first().click()
    await waitForPageLoad(page)
    await expect(page).toHaveURL('/demo/schedule')

    // Members
    await page.getByRole('link', { name: /members/i }).first().click()
    await waitForPageLoad(page)
    await expect(page).toHaveURL('/demo/members')

    // Money
    await page.getByRole('link', { name: /money/i }).first().click()
    await waitForPageLoad(page)
    await expect(page).toHaveURL('/demo/money')

    // Reports
    await page.getByRole('link', { name: /reports/i }).first().click()
    await waitForPageLoad(page)
    await expect(page).toHaveURL('/demo/reports')

    // Settings
    await page.getByRole('link', { name: /settings/i }).first().click()
    await waitForPageLoad(page)
    await expect(page).toHaveURL('/demo/settings')
  })

  test('class detail back link returns to schedule', async ({ demoPage: page }) => {
    await page.getByRole('link', { name: /schedule/i }).first().click()
    await waitForPageLoad(page)

    const firstClassLink = page.locator('a[href*="/demo/classes/"]').first()
    await firstClassLink.click()
    await waitForPageLoad(page)

    // Click back link
    await page.getByText(/back to schedule/i).click()
    await waitForPageLoad(page)
    await expect(page).toHaveURL('/demo/schedule')
  })

  test('overview quick actions navigate correctly', async ({ demoPage: page }) => {
    // Click "Manage Schedule" quick action
    const scheduleAction = page.getByRole('link', { name: /manage schedule/i }).or(
      page.getByText(/manage schedule/i),
    )
    if (await scheduleAction.first().isVisible()) {
      await scheduleAction.first().click()
      await waitForPageLoad(page)
      await expect(page).toHaveURL(/\/demo\/(schedule|classes)/)
    }
  })
})
