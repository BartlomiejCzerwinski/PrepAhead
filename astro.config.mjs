// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import vercel from '@astrojs/vercel';

// https://astro.build/config
export default defineConfig({
  integrations: [react()],

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

  adapter: vercel({ maxDuration: 60 })
});
