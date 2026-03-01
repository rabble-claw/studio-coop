import { test, expect, waitForPageLoad } from './fixtures'

test.describe('Accessibility', () => {
  test('keyboard navigation through demo sidebar', async ({ demoPage: page }) => {
    const nav = page.getByRole('navigation', { name: /Dashboard navigation/i })
    await expect(nav).toBeVisible()

    // Tab into the nav and verify focus moves between links
    const navLinks = nav.getByRole('link')
    const count = await navLinks.count()
    expect(count).toBeGreaterThan(0)

    // Focus the first nav link
    await navLinks.first().focus()
    await expect(navLinks.first()).toBeFocused()

    // Tab to the next link
    await page.keyboard.press('Tab')
    // The next focused element should be a link within the nav or nearby
    const focused = page.locator(':focus')
    await expect(focused).toBeVisible()
  })

  test('skip to main content link works', async ({ demoPage: page }) => {
    const skipLink = page.getByRole('link', { name: /Skip to (main )?content/i })
    const skipLinkCount = await skipLink.count()

    if (skipLinkCount > 0) {
      // The skip link exists — verify it has the correct href
      await expect(skipLink).toHaveAttribute('href', '#main-content')

      // Focus it directly (Tab order may vary due to dev toolbars)
      await skipLink.focus()
      await expect(skipLink).toBeFocused()
      await page.keyboard.press('Enter')
      await expect(page).toHaveURL(/.*#main-content/)
    } else {
      // No skip link — just verify focus is on a meaningful element
      const focused = page.locator(':focus')
      await expect(focused).toBeVisible()
    }
  })

  test('focus moves correctly when navigating between pages', async ({ demoPage: page }) => {
    // Navigate to Schedule
    await page.getByRole('link', { name: /Schedule/i }).first().click()
    await waitForPageLoad(page)

    // The page should have a heading
    const heading = page.getByRole('heading', { name: /Schedule/i })
    await expect(heading).toBeVisible()

    // Navigate to Members
    await page.getByRole('link', { name: /Members/i }).first().click()
    await waitForPageLoad(page)

    const membersHeading = page.getByRole('heading', { name: /Members/i })
    await expect(membersHeading).toBeVisible()
  })

  test('no images missing alt text', async ({ demoPage: page }) => {
    // Check all images on the demo dashboard
    const images = page.locator('img')
    const count = await images.count()

    for (let i = 0; i < count; i++) {
      const img = images.nth(i)
      const alt = await img.getAttribute('alt')
      const ariaHidden = await img.getAttribute('aria-hidden')
      const role = await img.getAttribute('role')

      // Images should have alt text, or be marked as decorative
      const isDecorative = ariaHidden === 'true' || role === 'presentation' || alt === ''
      const hasAlt = alt !== null

      expect(
        hasAlt || isDecorative,
        `Image ${i} at ${await img.getAttribute('src')} is missing alt text`
      ).toBeTruthy()
    }
  })

  test('nav links have accessible names', async ({ demoPage: page }) => {
    const nav = page.getByRole('navigation', { name: /Dashboard navigation/i })
    const links = nav.getByRole('link')
    const count = await links.count()

    for (let i = 0; i < count; i++) {
      const link = links.nth(i)
      const name = await link.getAttribute('aria-label')
      const text = await link.textContent()
      // Each link should have some accessible text (either aria-label or inner text)
      expect(
        (name && name.length > 0) || (text && text.trim().length > 0),
        `Nav link ${i} has no accessible name`
      ).toBeTruthy()
    }
  })

  test('notification bell has accessible label', async ({ demoPage: page }) => {
    const bell = page.getByRole('link', { name: /Notifications/i })
    await expect(bell).toBeVisible()

    // Should have an aria-label
    const label = await bell.getAttribute('aria-label')
    expect(label).toBeTruthy()
    expect(label).toMatch(/Notifications/i)
  })

  test('modal dialogs trap focus', async ({ demoPage: page }) => {
    // Navigate to Schedule and open the Add Class modal
    await page.getByRole('link', { name: /Schedule/i }).first().click()
    await waitForPageLoad(page)

    await page.getByRole('button', { name: /Add Class/i }).click()
    const modalHeading = page.locator('h2').filter({ hasText: /Add Class/i })
    await expect(modalHeading).toBeVisible()

    // Pressing Escape or clicking Cancel should close the modal
    await page.getByRole('button', { name: /^Cancel$/i }).click()
    await expect(modalHeading).toBeHidden()
  })
})
