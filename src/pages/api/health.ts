import type { APIRoute } from 'astro';

import { jsonResponse } from '../../lib/server/response';

export const prerender = false;

export const GET: APIRoute = () => {
  return jsonResponse({
    ok: true,
    timestamp: new Date().toISOString(),
  });
};
