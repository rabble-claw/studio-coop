import { test, expect, waitForPageLoad } from './fixtures'
import { SEED } from './helpers/seed'

test.describe('Auth Flows @auth', () => {
  test('owner login redirects to dashboard with studio heading', async ({ page }) => {
    await page.goto('/login')
    await waitForPageLoad(page)

    await page.getByPlaceholder(/email/i).fill(SEED.owner.email)
    await page.getByPlaceholder(/password/i).fill(SEED.owner.password)
    await page.getByRole('button', { name: /sign in$/i }).click()

    await page.waitForURL('**/dashboard**', { timeout: 15_000 })
    await waitForPageLoad(page)

    await expect(page.getByText(/empire aerial arts/i)).toBeVisible()
  })

  test('wrong password shows error, URL stays on /login', async ({ page }) => {
    await page.goto('/login')
    await waitForPageLoad(page)

    await page.getByPlaceholder(/email/i).fill(SEED.owner.email)
    await page.getByPlaceholder(/password/i).fill('wrongpassword123')
    await page.getByRole('button', { name: /sign in$/i }).click()

    // Error message appears
    await expect(page.locator('.text-destructive')).toBeVisible({ timeout: 10_000 })

    // URL stays on login
    await expect(page).toHaveURL(/\/login/)
  })

  test('unauthenticated access to /dashboard redirects to /login', async ({ page }) => {
    await page.goto('/dashboard')
    // Client-side redirect to login
    await page.waitForURL('**/login**', { timeout: 15_000 })
    await expect(page).toHaveURL(/\/login/)
  })

  test('signup redirects to /dashboard/setup', async ({ page }) => {
    const timestamp = Date.now()
    const email = `test-${timestamp}@e2e.test`

    await page.goto('/login?mode=signup')
    await waitForPageLoad(page)

    await page.getByPlaceholder(/name/i).fill('E2E Test User')
    await page.getByPlaceholder(/email/i).fill(email)
    await page.getByPlaceholder(/password/i).fill('testpass123!')
    await page.getByRole('button', { name: /create account/i }).click()

    await page.waitForURL('**/dashboard/setup**', { timeout: 15_000 })
    await expect(page).toHaveURL(/\/dashboard\/setup/)
  })
})
