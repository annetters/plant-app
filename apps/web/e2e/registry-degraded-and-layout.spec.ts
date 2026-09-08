import { test, expect } from '@playwright/test'
import { signInAsQaAccount, seedPlants, wipeAccount, SEED_PLANT_COUNT } from './seed'

/**
 * Ticket #10 items 3 and 4, plus ticket #3's two remaining browser checks.
 *
 * `wipeAccount` here leaves the QA account with Plants but no Property, which
 * is exactly the degraded state item 3 asks about — and the reason these
 * tests re-seed rather than trusting whatever the previous spec file left
 * behind.
 */

test.beforeAll(async () => {
  const { client, userId } = await signInAsQaAccount()
  await wipeAccount(client, userId)
  await seedPlants(client, userId)
})

test.describe('with no Property or Beds yet', () => {
  test('the Registry still loads and filters, just with no map links', async ({ page }) => {
    await page.goto('/registry')
    await expect(page.locator('ul.plant-list > li')).toHaveCount(SEED_PLANT_COUNT)
    await expect(page.getByRole('link', { name: /on the map/i })).toHaveCount(0)

    // Filtering must still work — the absence of a Property shouldn't
    // degrade the Registry's own behaviour.
    await page.getByLabel('Sun/shade').selectOption('full-shade')
    await expect(page.locator('ul.plant-list > li')).toHaveCount(4)
    await expect(page.getByRole('link', { name: /on the map/i })).toHaveCount(0)
  })
})

test('a nonexistent plant ID reports "Plant not found."', async ({ page }) => {
  // Ticket #3, item 2. Well-formed UUID, no such row — the same message the
  // cross-account case gives via RLS (item 1, already passed on 2026-09-02).
  await page.goto('/registry/00000000-0000-4000-8000-000000000000')
  await expect(page.getByText('Plant not found.')).toBeVisible()
})

test('a reference photo still renders after a reload', async ({ page }) => {
  // Ticket #3, item 3 — this exercises the signed-URL fetch on a fresh mount,
  // which in-session state would mask. A real PNG, not the 4-byte fake the
  // earlier automated pass used, so the upload path is genuinely exercised.
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAIAQMAAAD+wSzIAAAABlBMVEX///+/v7+jQ3Y5AAAADklEQVQI12P4AIX8EAgALgAD/aNpbtEAAAAASUVORK5CYII=',
    'base64',
  )

  await page.goto('/registry')
  await page.getByRole('link', { name: /^Hosta/ }).click()
  await expect(page).toHaveURL(/\/registry\/[0-9a-f-]+$/)

  await page.getByLabel('Add reference photos').setInputFiles({
    name: 'hosta-reference.png',
    mimeType: 'image/png',
    buffer: png,
  })

  const thumbnail = page.locator('img').first()
  await expect(thumbnail).toBeVisible()

  await page.reload()

  // Presence in the DOM isn't the assertion — a broken signed URL still
  // renders an <img>. naturalWidth is what proves the bytes actually loaded.
  await expect(thumbnail).toBeVisible()
  await expect
    .poll(async () => thumbnail.evaluate((img: HTMLImageElement) => img.naturalWidth), { timeout: 15_000 })
    .toBeGreaterThan(0)
})

test('the filter panel does not overflow a phone-width viewport', async ({ page }) => {
  // Ticket #10, item 4 — the automatable half only. This catches horizontal
  // overflow (the failure mode #9's QA found in this area); it cannot judge
  // whether the layout merely looks cramped, which stays a human check.
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/registry')
  await expect(page.locator('ul.plant-list > li')).toHaveCount(SEED_PLANT_COUNT)

  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }))
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1)

  // Every filter control must still be reachable, not clipped out of the page.
  for (const label of ['Search', 'Flower color', 'Bloom month', 'Sun/shade', 'Foliage', 'Native status']) {
    await expect(page.getByLabel(label)).toBeVisible()
  }
})
