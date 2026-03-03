import { test, expect, waitForPageLoad } from './fixtures'

test.describe('Dashboard Members @auth', () => {
  test('members page shows heading + member count', async ({ ownerPage: page }) => {
    await page.getByRole('link', { name: /members/i }).first().click()
    await waitForPageLoad(page)

    await expect(page.getByRole('heading', { level: 1 })).toContainText('Members')

    // Total member count in subtitle (e.g., "20 members")
    await expect(page.getByText(/\d+ members/i)).toBeVisible({ timeout: 10_000 })
  })

  test('role badges visible: owner, teacher, member', async ({ ownerPage: page }) => {
    await page.getByRole('link', { name: /members/i }).first().click()
    await waitForPageLoad(page)

    // All 3 role badge types present
    await expect(page.getByText('owner', { exact: true }).first()).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('teacher', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('member', { exact: true }).first()).toBeVisible()
  })

  test('owner card appears first (sorted by role)', async ({ ownerPage: page }) => {
    await page.getByRole('link', { name: /members/i }).first().click()
    await waitForPageLoad(page)

    // First member card should be Alex Rivera (owner)
    const firstCard = page.locator('a[href*="/dashboard/members/"]').first()
    await expect(firstCard).toContainText('Alex Rivera', { timeout: 10_000 })
    await expect(firstCard).toContainText('owner')
  })

  test('search filters by name ("Aroha")', async ({ ownerPage: page }) => {
    await page.getByRole('link', { name: /members/i }).first().click()
    await waitForPageLoad(page)

    // Wait for members to load
    await expect(page.getByText('Alex Rivera')).toBeVisible({ timeout: 10_000 })

    // Search for Aroha
    await page.getByPlaceholder(/search/i).fill('Aroha')
    await page.waitForTimeout(300)

    // Aroha should be visible
    await expect(page.getByText('Aroha Patel')).toBeVisible()

    // Alex should be hidden (filtered out)
    await expect(page.getByText('Alex Rivera')).toBeHidden()
  })

  test('search filters by email ("jade@")', async ({ ownerPage: page }) => {
    await page.getByRole('link', { name: /members/i }).first().click()
    await waitForPageLoad(page)

    await expect(page.getByText('Alex Rivera')).toBeVisible({ timeout: 10_000 })

    await page.getByPlaceholder(/search/i).fill('jade@')
    await page.waitForTimeout(300)

    // Jade should be visible
    await expect(page.getByText('Jade Nguyen')).toBeVisible()

    // Only 1 result: the member cards should show just Jade
    const memberLinks = page.locator('a[href*="/dashboard/members/"]')
    await expect(memberLinks).toHaveCount(1)
  })

  test('click member → detail page with name heading', async ({ ownerPage: page }) => {
    await page.getByRole('link', { name: /members/i }).first().click()
    await waitForPageLoad(page)

    // Wait for members to load, then search for Aroha to get a stable target
    await expect(page.getByText('Aroha Patel')).toBeVisible({ timeout: 10_000 })

    await page.getByPlaceholder(/search/i).fill('Aroha')
    await page.waitForTimeout(300)

    // Click into Aroha's detail page
    await page.locator('a[href*="/dashboard/members/"]').first().click()
    await waitForPageLoad(page)

    await expect(page).toHaveURL(/\/dashboard\/members\//)
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Aroha Patel')
  })

  test('member detail shows role badge + active status', async ({ ownerPage: page }) => {
    await page.getByRole('link', { name: /members/i }).first().click()
    await waitForPageLoad(page)

    await expect(page.getByText('Aroha Patel')).toBeVisible({ timeout: 10_000 })
    await page.getByPlaceholder(/search/i).fill('Aroha')
    await page.waitForTimeout(300)

    await page.locator('a[href*="/dashboard/members/"]').first().click()
    await waitForPageLoad(page)

    // Role badge
    await expect(page.getByText('member', { exact: true }).first()).toBeVisible({ timeout: 10_000 })

    // Active status
    await expect(page.getByText(/active/i).first()).toBeVisible()
  })

  test('member detail shows attendance section', async ({ ownerPage: page }) => {
    await page.getByRole('link', { name: /members/i }).first().click()
    await waitForPageLoad(page)

    await expect(page.getByText('Aroha Patel')).toBeVisible({ timeout: 10_000 })
    await page.getByPlaceholder(/search/i).fill('Aroha')
    await page.waitForTimeout(300)

    await page.locator('a[href*="/dashboard/members/"]').first().click()
    await waitForPageLoad(page)

    await expect(page.getByText(/attendance/i).first()).toBeVisible({ timeout: 10_000 })
  })

  test('teacher can view member list + Invite button', async ({ teacherPage: page }) => {
    await page.getByRole('link', { name: /members/i }).first().click()
    await waitForPageLoad(page)

    await expect(page.getByRole('heading', { level: 1 })).toContainText('Members')

    // Invite button visible for staff
    await expect(page.getByRole('button', { name: /invite/i })).toBeVisible({ timeout: 10_000 })
  })

  test('teacher can navigate to member detail', async ({ teacherPage: page }) => {
    await page.getByRole('link', { name: /members/i }).first().click()
    await waitForPageLoad(page)

    // Wait for member list to load
    const firstMemberLink = page.locator('a[href*="/dashboard/members/"]').first()
    await expect(firstMemberLink).toBeVisible({ timeout: 10_000 })

    await firstMemberLink.click()
    await waitForPageLoad(page)

    await expect(page).toHaveURL(/\/dashboard\/members\//)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })

  test('member (Aroha) can view member list', async ({ memberPage: page }) => {
    await page.getByRole('link', { name: /members/i }).first().click()
    await waitForPageLoad(page)

    await expect(page.getByRole('heading', { level: 1 })).toContainText('Members')

    // Alex Rivera (owner) should be visible in the list
    await expect(page.getByText('Alex Rivera')).toBeVisible({ timeout: 10_000 })
  })

  test('member can search and find themselves', async ({ memberPage: page }) => {
    await page.getByRole('link', { name: /members/i }).first().click()
    await waitForPageLoad(page)

    await expect(page.getByText('Alex Rivera')).toBeVisible({ timeout: 10_000 })

    await page.getByPlaceholder(/search/i).fill('Aroha')
    await page.waitForTimeout(300)

    await expect(page.getByText('Aroha Patel')).toBeVisible()
  })
})
