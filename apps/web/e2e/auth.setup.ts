import { test as setup, expect } from '@playwright/test'
import { QA_EMAIL, QA_PASSWORD, signInAsQaAccount, wipeAccount, seedPlants } from './seed'

const STORAGE_STATE = 'e2e/.auth/qa.json'

/**
 * Resets the QA account to a known state and logs the browser in once, so
 * each spec starts from the same six seeded Plants and no Property.
 *
 * Logging in through the real form rather than injecting a token is
 * deliberate: it is the only place these tests exercise the auth path, and a
 * broken login would otherwise surface as six confusing unrelated failures.
 */
setup('seed the QA account and sign in', async ({ page }) => {
  const { client, userId } = await signInAsQaAccount()
  await wipeAccount(client, userId)
  await seedPlants(client, userId)

  await page.goto('/login')
  await page.getByLabel('Email').fill(QA_EMAIL)
  await page.getByLabel('Password').fill(QA_PASSWORD)
  await page.getByRole('button', { name: /sign in|log in/i }).click()

  await expect(page).toHaveURL(/\/dashboard/)
  await page.context().storageState({ path: STORAGE_STATE })
})
