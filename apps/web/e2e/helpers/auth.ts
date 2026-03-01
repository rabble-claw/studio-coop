import type { Page } from '@playwright/test'

/**
 * Log in via the web UI login form.
 * Fills email + password and waits for redirect to /dashboard.
 */
export async function loginViaUI(page: Page, email: string, password: string) {
  await page.goto('/login')
  await page.getByPlaceholder(/email/i).fill(email)
  await page.getByPlaceholder(/password/i).fill(password)
  await page.getByRole('button', { name: /sign in/i }).click()
  await page.waitForURL('**/dashboard**', { timeout: 15_000 })
}

/**
 * Sign up via the web UI signup form.
 * Fills name + email + password and waits for redirect to /dashboard/setup.
 */
export async function signupViaUI(
  page: Page,
  name: string,
  email: string,
  password: string,
) {
  await page.goto('/login?mode=signup')
  await page.getByPlaceholder(/name/i).fill(name)
  await page.getByPlaceholder(/email/i).fill(email)
  await page.getByPlaceholder(/password/i).fill(password)
  await page.getByRole('button', { name: /create account/i }).click()
  await page.waitForURL('**/dashboard/setup**', { timeout: 15_000 })
}
