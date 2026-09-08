import { test, expect, type Page } from '@playwright/test'
import { SEED_PLANTS_ALPHABETICAL, SEED_PLANT_COUNT } from './seed'

/**
 * Ticket #10, item 1 — the Registry's core acceptance criterion, and the one
 * item on the whole QA board that had never been run by anything. Each filter
 * axis alone, then combinations, then the empty state.
 */

/** The Plant names currently listed, in the order shown. Scoped to the top-level list links so Planting-location links don't leak in. */
async function listedPlants(page: Page): Promise<string[]> {
  const links = page.locator('ul.plant-list > li > a')
  const count = await links.count()
  const names: string[] = []
  for (let i = 0; i < count; i++) {
    // The link reads "Label — Scientific name"; the label is what identifies the Plant.
    const text = (await links.nth(i).textContent()) ?? ''
    names.push(text.split('—')[0].trim())
  }
  return names
}

async function clearFilters(page: Page): Promise<void> {
  await page.getByLabel('Search').fill('')
  await page.getByLabel('Flower color').fill('')
  await page.getByLabel('Bloom month').selectOption('')
  await page.getByLabel('Sun/shade').selectOption('')
  await page.getByLabel('Foliage').selectOption('')
  await page.getByLabel('Native status').selectOption('')
}

test.beforeEach(async ({ page }) => {
  await page.goto('/registry')
  await expect(page.locator('ul.plant-list > li')).toHaveCount(SEED_PLANT_COUNT)
})

test.describe('each filter axis alone', () => {
  test('search matches a partial common name', async ({ page }) => {
    await page.getByLabel('Search').fill('cone')
    expect(await listedPlants(page)).toEqual(['Purple Coneflower'])
  })

  test('search matches a scientific name', async ({ page }) => {
    await page.getByLabel('Search').fill('Rudbeckia')
    expect(await listedPlants(page)).toEqual(['Black-eyed Susan (Goldsturm)'])
  })

  test('search matches a cultivar', async ({ page }) => {
    await page.getByLabel('Search').fill('Goldsturm')
    expect(await listedPlants(page)).toEqual(['Black-eyed Susan (Goldsturm)'])
  })

  test('flower color matches a substring', async ({ page }) => {
    await page.getByLabel('Flower color').fill('pur')
    expect(await listedPlants(page)).toEqual(['Purple Coneflower'])
  })

  test('bloom month includes every Plant whose window spans it', async ({ page }) => {
    // July falls inside four of the seeded bloom windows. The Plants with no
    // window at all must drop out rather than be treated as always-blooming.
    await page.getByLabel('Bloom month').selectOption('7')
    expect(await listedPlants(page)).toEqual([
      'Astilbe',
      'Black-eyed Susan (Goldsturm)',
      'Hosta',
      'Purple Coneflower',
    ])
  })

  test('sun/shade matches exactly, not by prefix', async ({ page }) => {
    // 'full-shade' shares a prefix with 'full-sun'; a sloppy startsWith would
    // pull the two full-sun Plants in here.
    await page.getByLabel('Sun/shade').selectOption('full-shade')
    expect(await listedPlants(page)).toEqual(['Hosta', 'Japanese Sedge', 'Mayapple', 'Wild Ginger'])
  })

  test('foliage type filters', async ({ page }) => {
    await page.getByLabel('Foliage').selectOption('evergreen')
    expect(await listedPlants(page)).toEqual(['Boxwood', 'Inkberry', 'Japanese Sedge', 'Wild Ginger'])
  })

  test('native status filters', async ({ page }) => {
    await page.getByLabel('Native status').selectOption('native')
    expect(await listedPlants(page)).toEqual([
      'Black-eyed Susan (Goldsturm)',
      'Inkberry',
      'Mayapple',
      'Purple Coneflower',
      'Wild Ginger',
    ])
  })
})

test.describe('combined filters are an intersection, not a union', () => {
  test('two axes', async ({ page }) => {
    // full-shade alone gives four Plants; native alone gives five. A union
    // would list seven; the intersection is two.
    await page.getByLabel('Sun/shade').selectOption('full-shade')
    await page.getByLabel('Native status').selectOption('native')
    expect(await listedPlants(page)).toEqual(['Mayapple', 'Wild Ginger'])
  })

  test('three axes, each of which is load-bearing', async ({ page }) => {
    // The seed guarantees every pair of these three still leaves a second
    // Plant in, so dropping ANY one axis changes the result. See SEED_PLANTS.
    await page.getByLabel('Sun/shade').selectOption('full-shade')
    await page.getByLabel('Foliage').selectOption('evergreen')
    await page.getByLabel('Native status').selectOption('native')
    expect(await listedPlants(page)).toEqual(['Wild Ginger'])
  })

  test('bloom month narrows a sun filter', async ({ page }) => {
    // Four Plants are full-shade, but only Hosta blooms in July.
    await page.getByLabel('Sun/shade').selectOption('full-shade')
    await page.getByLabel('Bloom month').selectOption('7')
    expect(await listedPlants(page)).toEqual(['Hosta'])
  })

  test('search combines with a dropdown rather than widening it', async ({ page }) => {
    await page.getByLabel('Search').fill('susan')
    await page.getByLabel('Native status').selectOption('native')
    expect(await listedPlants(page)).toEqual(['Black-eyed Susan (Goldsturm)'])

    // The same search against the opposite status must go empty — under a
    // union it would instead list every non-native Plant.
    await page.getByLabel('Native status').selectOption('non-native')
    await expect(page.getByText('No Plants match these filters.')).toBeVisible()
  })
})

test('clearing every filter returns the full list', async ({ page }) => {
  await page.getByLabel('Sun/shade').selectOption('full-shade')
  await page.getByLabel('Native status').selectOption('native')
  expect(await listedPlants(page)).toEqual(['Mayapple', 'Wild Ginger'])

  await clearFilters(page)
  expect(await listedPlants(page)).toEqual(SEED_PLANTS_ALPHABETICAL)
})

test('a filter matching nothing explains itself instead of going blank', async ({ page }) => {
  await page.getByLabel('Search').fill('zzzzz-no-such-plant')
  // The specific failure #10 calls out: a bare empty list reads as broken.
  await expect(page.getByText('No Plants match these filters.')).toBeVisible()
  await expect(page.locator('ul.plant-list')).toHaveCount(0)
})

test('the Registry lists Plants alphabetically by common name', async ({ page }) => {
  // Ticket #3, item 4. Ordering is done in Postgres (`order('common_name')`),
  // and the seed's insertion order deliberately differs from this.
  expect(await listedPlants(page)).toEqual(SEED_PLANTS_ALPHABETICAL)
})
