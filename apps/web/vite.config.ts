import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Konva's package.json only offers old-style "main"/"browser" fields
      // (no exports map), which Vite's SSR-style module resolution — used
      // under Vitest even in a jsdom environment — doesn't honor. Without
      // this, `import Konva from 'konva'` resolves to the Node-targeted
      // build, which requires the optional `canvas` npm package we don't
      // (and shouldn't, for a browser-only drawing surface) install.
      konva: 'konva/lib/index.js',
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
  },
})
