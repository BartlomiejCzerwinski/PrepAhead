import type { APIRoute } from 'astro';

import { jsonResponse } from '../../../../lib/server/response';
import { createSupabaseServerClient } from '../../../../lib/supabase/server';

export const prerender = false;

function mergeHeaders(target: Headers, source: Headers): void {
  source.forEach((value, key) => {
    target.set(key, value);
  });
}

export const POST: APIRoute = async ({ params, request, cookies }) => {
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
        message: 'You must be signed in to delete a practice set.',
      },
      { status: 401, headers: responseHeaders },
    );
  }

  const practiceSetId = typeof params.id === 'string' ? params.id.trim() : '';

  if (!practiceSetId) {
    return jsonResponse(
      { ok: false, error: 'missing_practice_set_id', message: 'Practice set id is required.' },
      { status: 400, headers: responseHeaders },
    );
  }

  // Soft-delete: a single ownership-scoped UPDATE. The `.is('deleted_at', null)`
  // guard makes a non-owner / missing / already-deleted set return zero rows,
  // which we treat as 404 — no separate read, no content ever leaves the DB.
  const { data: deletedRows, error: deleteError } = await supabase
    .from('practice_sets')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', practiceSetId)
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .select('id');

  if (deleteError) {
    return jsonResponse(
      {
        ok: false,
        error: 'delete_failed',
        message: 'Could not delete this practice set. Please try again.',
      },
      { status: 500, headers: responseHeaders },
    );
  }

  if (!deletedRows?.length) {
    return jsonResponse(
      { ok: false, error: 'practice_set_not_found', message: 'Practice set not found.' },
      { status: 404, headers: responseHeaders },
    );
  }

  return jsonResponse({ ok: true }, { status: 200, headers: responseHeaders });
};
