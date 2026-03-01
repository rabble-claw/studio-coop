import { test, expect, waitForPageLoad } from './fixtures'

test.describe('Public Pages', () => {
  test('landing page renders hero heading and CTAs', async ({ page }) => {
    await page.goto('/')
    await waitForPageLoad(page)

    await expect(page.getByRole('heading', { level: 1 })).toContainText('your community')
    // "Start free" appears in hero, "Get started" appears in CTA section
    await expect(page.getByRole('link', { name: /start free/i }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: /see the demo/i }).first()).toBeVisible()
  })

  test('CTAs link to correct destinations', async ({ page }) => {
    await page.goto('/')
    await waitForPageLoad(page)

    const startFree = page.getByRole('link', { name: /start free/i }).first()
    await expect(startFree).toHaveAttribute('href', '/login?mode=signup')

    const seeDemo = page.getByRole('link', { name: /see the demo/i }).first()
    await expect(seeDemo).toHaveAttribute('href', '/demo')
  })

  test('login page switches between login, signup, and magic-link modes', async ({ page }) => {
    await page.goto('/login')
    await waitForPageLoad(page)

    // Default mode is login — submit button text is "Sign in" (exact match)
    await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible()

    // Switch to magic link — text is "Sign in with magic link instead"
    await page.getByText('Sign in with magic link instead').click()
    await expect(page.getByRole('button', { name: 'Send magic link' })).toBeVisible()

    // Switch back to password login — text is "Back to password sign in"
    await page.getByText('Back to password sign in').click()
    await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible()

    // Switch to signup — text is "Sign up"
    await page.getByText('Sign up').click()
    await expect(page.getByRole('button', { name: 'Create account' })).toBeVisible()
    // Name field visible in signup mode
    await expect(page.getByPlaceholder('Your name')).toBeVisible()
  })

  test('explore page renders heading and search form', async ({ page }) => {
    await page.goto('/explore')
    // Explore is a server component — may take a moment
    await page.waitForLoadState('domcontentloaded')

    // The heading should appear even if DB query returns no results
    await expect(page.getByText('Find Your Studio')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByPlaceholder(/search studios/i)).toBeVisible()
  })

  test('explore page Near Me button and discipline filters exist', async ({ page }) => {
    await page.goto('/explore')
    await page.waitForLoadState('domcontentloaded')

    await expect(page.getByText('Find Your Studio')).toBeVisible({ timeout: 10_000 })

    // Near Me button
    await expect(page.getByText('Near Me')).toBeVisible()

    // Discipline pills
    await expect(page.getByRole('button', { name: 'All' }).first()).toBeVisible()
  })
})
