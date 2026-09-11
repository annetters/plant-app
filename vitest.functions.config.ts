import { defineConfig } from 'vitest/config'

/**
 * Edge Functions are Deno, not Node, and are deployed rather than bundled by
 * any workspace — so they sit outside `npm test --workspaces`. This config
 * gives their *pure* modules a test runner anyway (#47).
 *
 * Only modules that import nothing Deno-specific are testable here: the
 * `index.ts` entry points call `Deno.serve` and pull `_shared/auth.ts`, which
 * imports supabase-js from an `https://esm.sh` URL that Vite can't resolve.
 * That is the seam — the handler stays thin and does auth, parsing and
 * responses, while everything worth testing takes a narrow client interface
 * as an argument and lives in `_shared/`.
 */
export default defineConfig({
  test: {
    include: ['supabase/functions/**/*.test.ts'],
    environment: 'node',
  },
})
