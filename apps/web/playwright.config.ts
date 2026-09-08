import { defineConfig, devices } from '@playwright/test'

/**
 * E2E config for ticket #10's Registry checklist (tracked in #34's sibling
 * list — #10's items had never been run by anything, human or automated).
 *
 * Runs against the real linked Supabase project, as every manual QA pass in
 * this repo has: there is no local stack (see the Docker-free tooling
 * decision in the handoff). Data is seeded and torn down under a dedicated
 * throwaway account, never the user's own — `e2e/seed.ts` refuses to run
 * against an account whose email isn't the designated QA one.
 */
export default defineConfig({
  testDir: './e2e',
  // Seeding is shared mutable state on one Supabase account, so specs within
  // a file run in order and files don't race each other.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], storageState: 'e2e/.auth/qa.json' },
      dependencies: ['setup'],
    },
    {
      // #10 item 4 asks for a WebKit pass explicitly. Note this is
      // Playwright's WebKit build, not Safari itself — it catches most
      // WebKit-only rendering gaps (this repo has a real one in its history,
      // #5's dropdown) but is not a substitute for opening actual Safari.
      name: 'webkit',
      use: { ...devices['Desktop Safari'], storageState: 'e2e/.auth/qa.json' },
      dependencies: ['setup'],
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 60_000,
  },
})
