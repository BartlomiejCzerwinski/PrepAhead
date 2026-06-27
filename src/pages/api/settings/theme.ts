import type { APIRoute } from 'astro';

import { isTheme } from '../../../lib/theme/client';
import { jsonResponse } from '../../../lib/server/response';
import { createSupabaseServerClient } from '../../../lib/supabase/server';

export const prerender = false;

function mergeHeaders(target: Headers, source: Headers): void {
  source.forEach((value, key) => {
    target.set(key, value);
  });
}

type ThemeRequestBody = {
  theme?: unknown;
};

export const POST: APIRoute = async ({ request, cookies }) => {
  const authHeaders = new Headers();
  const supabase = createSupabaseServerClient(request, cookies, authHeaders);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const responseHeaders = new Headers();
  mergeHeaders(responseHeaders, authHeaders);

  if (!user) {
    return jsonResponse(
      {
        ok: false,
        error: 'unauthorized',
        message: 'You must be signed in to save a theme preference.',
      },
      { status: 401, headers: responseHeaders },
    );
  }

  let body: ThemeRequestBody;
  try {
    body = (await request.json()) as ThemeRequestBody;
  } catch {
    return jsonResponse(
      { ok: false, error: 'invalid_json', message: 'Request body must be valid JSON.' },
      { status: 400, headers: responseHeaders },
    );
  }

  if (!isTheme(body.theme)) {
    return jsonResponse(
      {
        ok: false,
        error: 'invalid_theme',
        message: "theme must be one of 'light', 'dark', or 'system'.",
      },
      { status: 400, headers: responseHeaders },
    );
  }

  const { error: upsertError } = await supabase
    .from('user_settings')
    .upsert({ user_id: user.id, theme: body.theme }, { onConflict: 'user_id' });

  if (upsertError) {
    return jsonResponse(
      {
        ok: false,
        error: 'update_failed',
        message: 'Could not save your theme preference. Please try again.',
      },
      { status: 500, headers: responseHeaders },
    );
  }

  return jsonResponse({ ok: true }, { status: 200, headers: responseHeaders });
};
