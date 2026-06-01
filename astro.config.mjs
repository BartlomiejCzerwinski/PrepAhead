// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import vercel from '@astrojs/vercel';

/** @returns {string} */
function resolveSiteUrl() {
  const raw = process.env.PUBLIC_SITE_URL?.trim();
  if (raw) {
    return raw.replace(/\/$/, '');
  }
  if (process.env.VERCEL === '1' || process.env.CI === 'true') {
    throw new Error(
      'PUBLIC_SITE_URL is required on Vercel/CI (set in project env or .env.local for local builds).',
    );
  }
  return 'http://localhost:4321';
}

// https://astro.build/config
export default defineConfig({
  site: resolveSiteUrl(),
  integrations: [
    react(),
    sitemap({
      filter: (page) => !page.includes('/api/'),
    }),
  ],

  // One process per port — avoid Windows IPv4/IPv6 split (stale preview on 127.0.0.1 vs dev on localhost).
  server: {
    port: 4321,
    host: true,
  },

  vite: {
    plugins: [tailwindcss()],
    server: {
      strictPort: true,
    },
  },

  adapter: vercel({ maxDuration: 60 }),
});
