import { defineConfig } from 'vitest/config';

// Plain defineConfig (no Astro getViteConfig): Astro 6 ships Vite 7, and the
// getViteConfig() + Vitest 4 path crashes below vitest@4.1.0-beta.6. These are
// pure server-logic tests, so we sidestep the Astro/Tailwind plugin pipeline.
export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    include: ['test/**/*.test.ts', 'src/**/*.test.ts'],
  },
});
