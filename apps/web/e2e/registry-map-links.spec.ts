import { test, expect } from '@playwright/test'
import { signInAsQaAccount, seedPropertyWithPlantings, seedPlants, wipeAccount, SEED_PLANT_COUNT } from './seed'

/**
 * Ticket #10, item 2 — the Registry -> map jump. The interesting part is the
 * second click: `/code-review` added a ref-guard when this landed, and the
 * guard is only correct if it resets when `PropertyPage` remounts on
 * navigation. Clicking the same link twice is what proves that.
 */

test.beforeAll(async () => {
  const { client, userId } = await signInAsQaAccount()
  await wipeAccount(client, userId)
  const plantIds = await seedPlants(client, userId)
  await seedPropertyWithPlantings(client, userId, plantIds)
})

test.beforeEach(async ({ page }) => {
  await page.goto('/registry')
  await expect(page.locator('ul.plant-list > li')).toHaveCount(SEED_PLANT_COUNT)
})

test('a Plant with one Planting shows one map link, and it opens that Planting', async ({ page }) => {
  const coneflower = page.locator('ul.plant-list > li').filter({ hasText: 'Purple Coneflower' })
  const links = coneflower.getByRole('link', { name: /on the map/i })
  await expect(links).toHaveCount(1)
  await expect(links.first()).toHaveText('View in Front Border on the map')

  await links.first().click()
  await expect(page).toHaveURL(/\/map\?plantingId=/)

  // The panel must open on its own — the whole point is not hunting for the Pin.
  await expect(page.getByRole('heading', { name: 'Purple Coneflower' })).toBeVisible()
  await expect(page.getByText('Quantity: 1')).toBeVisible()
  await expect(page.getByText('Year acquired: 2022')).toBeVisible()
  await expect(page.getByText('Source: QA Nursery')).toBeVisible()
})

test('a Plant in two Beds shows a link per Bed, each opening its own Planting', async ({ page }) => {
  const hosta = page.locator('ul.plant-list > li').filter({ hasText: 'Hosta' })
  const links = hosta.getByRole('link', { name: /on the map/i })
  await expect(links).toHaveCount(2)
  await expect(links).toHaveText(['View in Front Border on the map', 'View in Shade Bed on the map'])

  // Each link must open its OWN Planting, not just any Planting of that Plant.
  await links.filter({ hasText: 'Front Border' }).click()
  await expect(page.getByText('Quantity: 3')).toBeVisible()

  await page.goto('/registry')
  await hosta.getByRole('link', { name: /Shade Bed/i }).click()
  await expect(page.getByText('Quantity: 5')).toBeVisible()
})

test('the same link reopens after closing the panel and navigating back', async ({ page }) => {
  // The ref-guard regression: it must reset when PropertyPage remounts.
  const hosta = page.locator('ul.plant-list > li').filter({ hasText: 'Hosta' })
  await hosta.getByRole('link', { name: /Front Border/i }).click()
  await expect(page.getByText('Quantity: 3')).toBeVisible()

  await page.getByRole('button', { name: 'Close' }).click()
  await expect(page.getByText('Quantity: 3')).toBeHidden()

  await page.goto('/registry')
  await hosta.getByRole('link', { name: /Front Border/i }).click()
  await expect(page.getByText('Quantity: 3')).toBeVisible()
})

test('a Plant with no Planting shows no map link', async ({ page }) => {
  const astilbe = page.locator('ul.plant-list > li').filter({ hasText: 'Astilbe' })
  await expect(astilbe.getByRole('link', { name: /on the map/i })).toHaveCount(0)
})

test('a plantingId naming a deleted Planting loads the map without a panel or a crash', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  await page.goto('/map?plantingId=00000000-0000-4000-8000-000000000000')

  await expect(page.getByRole('heading', { name: 'Hosta' })).toBeHidden()
  await expect(page.getByText(/Quantity:/)).toBeHidden()
  expect(errors).toEqual([])
})
