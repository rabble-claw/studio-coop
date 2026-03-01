import { test, expect, waitForPageLoad } from './fixtures'

test.describe('Live Owner Dashboard @auth', () => {
  test('dashboard shows Empire Aerial Arts with member count', async ({ ownerPage: page }) => {
    await expect(page.getByText(/empire aerial arts/i)).toBeVisible()

    // Member count card shows a number > 0
    const memberCard = page.locator('[class*="card"]').filter({ hasText: /members/i }).first()
    await expect(memberCard).toBeVisible()
    const memberText = await memberCard.textContent()
    const memberCount = parseInt(memberText?.match(/\d+/)?.[0] ?? '0')
    expect(memberCount).toBeGreaterThan(0)
  })

  test('schedule shows seeded classes with dates and booking counts', async ({ ownerPage: page }) => {
    await page.getByRole('link', { name: /schedule/i }).first().click()
    await waitForPageLoad(page)

    await expect(page.getByRole('heading', { level: 1 })).toContainText('Schedule')

    // At least some classes are listed
    const classCards = page.locator('[class*="card"]')
    expect(await classCards.count()).toBeGreaterThan(0)

    // Booking count format: "N/M" visible somewhere
    await expect(page.getByText(/\d+\/\d+/)).toBeVisible()
  })

  test('members list shows 15+ members and search works', async ({ ownerPage: page }) => {
    await page.getByRole('link', { name: /members/i }).first().click()
    await waitForPageLoad(page)

    await expect(page.getByRole('heading', { level: 1 })).toContainText('Members')

    // At least 15 members
    const memberCards = page.locator('[class*="card"]')
    expect(await memberCards.count()).toBeGreaterThanOrEqual(15)

    // Search for Aroha
    await page.getByPlaceholder(/search/i).fill('Aroha')

    // Wait for filter to apply
    await page.waitForTimeout(300)

    const filteredCards = page.locator('[class*="card"]').filter({ hasText: /Aroha/ })
    await expect(filteredCards).toHaveCount(1)
  })

  test('settings: change phone, save, reload, verify persisted', async ({ ownerPage: page }) => {
    await page.getByRole('link', { name: /settings/i }).first().click()
    await waitForPageLoad(page)

    await expect(page.getByRole('heading', { level: 1 })).toContainText('Settings')

    // Find a text input and change its value
    const phoneInput = page.locator('input').filter({ hasText: '' }).nth(4)
    const newValue = `+64-${Date.now().toString().slice(-6)}`
    await phoneInput.fill(newValue)

    // Save
    await page.getByRole('button', { name: /save/i }).first().click()

    // Wait for save confirmation
    await page.waitForTimeout(1000)

    // Reload and verify
    await page.reload()
    await waitForPageLoad(page)

    // The saved value should persist (only works with real Supabase)
    const reloadedValue = await phoneInput.inputValue()
    expect(reloadedValue).toBe(newValue)
  })
})
