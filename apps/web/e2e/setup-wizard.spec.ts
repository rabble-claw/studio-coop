import { test, expect, waitForPageLoad } from './fixtures'

test.describe('Setup Wizard @auth', () => {
  test('step 1: fill studio info and create studio', async ({ page }) => {
    const timestamp = Date.now()

    // Sign up a fresh user first
    await page.goto('/login?mode=signup')
    await waitForPageLoad(page)

    await page.getByPlaceholder(/name/i).fill('Wizard Test')
    await page.getByPlaceholder(/email/i).fill(`wizard-${timestamp}@e2e.test`)
    await page.getByPlaceholder(/password/i).fill('testpass123!')
    await page.getByRole('button', { name: /create account/i }).click()

    await page.waitForURL('**/dashboard/setup**', { timeout: 15_000 })
    await waitForPageLoad(page)

    // Step 1: Studio info
    await expect(page.getByText(/tell us about your studio/i)).toBeVisible()

    // Fill studio name
    await page.getByLabel(/studio name/i).fill(`Test Studio ${timestamp}`)

    // Select discipline
    const disciplineSelect = page.locator('select').first()
    await disciplineSelect.selectOption('pole')

    // Fill city
    await page.getByLabel(/city/i).fill('Wellington')

    // Click Create Studio
    await page.getByRole('button', { name: /create studio/i }).click()

    // Should advance to step 2 (stripe)
    await expect(page.getByText(/connect payments/i)).toBeVisible({ timeout: 15_000 })
  })

  test('skip stripe and skip class → done step', async ({ page }) => {
    const timestamp = Date.now()

    // Quick signup + studio creation
    await page.goto('/login?mode=signup')
    await waitForPageLoad(page)
    await page.getByPlaceholder(/name/i).fill('Skip Test')
    await page.getByPlaceholder(/email/i).fill(`skip-${timestamp}@e2e.test`)
    await page.getByPlaceholder(/password/i).fill('testpass123!')
    await page.getByRole('button', { name: /create account/i }).click()
    await page.waitForURL('**/dashboard/setup**', { timeout: 15_000 })
    await waitForPageLoad(page)

    // Create studio
    await page.getByLabel(/studio name/i).fill(`Skip Studio ${timestamp}`)
    await page.getByRole('button', { name: /create studio/i }).click()
    await expect(page.getByText(/connect payments/i)).toBeVisible({ timeout: 15_000 })

    // Skip stripe
    await page.getByRole('button', { name: /skip for now/i }).click()
    await expect(page.getByText(/create your first class/i)).toBeVisible()

    // Skip class
    await page.getByRole('button', { name: /skip/i }).click()

    // Done step
    await expect(page.getByText(/you.*all set/i)).toBeVisible()
    await expect(page.getByText(/studio created/i)).toBeVisible()
  })

  test('done step: go to dashboard navigates correctly', async ({ page }) => {
    const timestamp = Date.now()

    await page.goto('/login?mode=signup')
    await waitForPageLoad(page)
    await page.getByPlaceholder(/name/i).fill('Done Test')
    await page.getByPlaceholder(/email/i).fill(`done-${timestamp}@e2e.test`)
    await page.getByPlaceholder(/password/i).fill('testpass123!')
    await page.getByRole('button', { name: /create account/i }).click()
    await page.waitForURL('**/dashboard/setup**', { timeout: 15_000 })
    await waitForPageLoad(page)

    // Quick setup: create → skip stripe → skip class
    await page.getByLabel(/studio name/i).fill(`Done Studio ${timestamp}`)
    await page.getByRole('button', { name: /create studio/i }).click()
    await expect(page.getByText(/connect payments/i)).toBeVisible({ timeout: 15_000 })
    await page.getByRole('button', { name: /skip for now/i }).click()
    await expect(page.getByText(/create your first class/i)).toBeVisible()
    await page.getByRole('button', { name: /skip/i }).click()

    // Done step
    await expect(page.getByText(/you.*all set/i)).toBeVisible()

    // Click go to dashboard
    await page.getByRole('button', { name: /go to dashboard/i }).click()
    await page.waitForURL('**/dashboard', { timeout: 10_000 })
    await expect(page).toHaveURL(/\/dashboard$/)
  })
})
