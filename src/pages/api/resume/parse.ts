import type { APIRoute } from 'astro';

import { parsePdfResume, ResumeParseError } from '../../../lib/server/resume/parse-pdf';
import { jsonResponse } from '../../../lib/server/response';
import { createSupabaseServerClient } from '../../../lib/supabase/server';

export const prerender = false;

function mergeHeaders(target: Headers, source: Headers): void {
  source.forEach((value, key) => {
    target.set(key, value);
  });
}

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
      { ok: false, error: 'unauthorized', message: 'You must be signed in to upload a PDF.' },
      { status: 401, headers: responseHeaders },
    );
  }

  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    return jsonResponse(
      { ok: false, error: 'invalid_request', message: 'Upload a single PDF file.' },
      { status: 400, headers: responseHeaders },
    );
  }

  const uploadedFile = formData.get('file');
  if (!(uploadedFile instanceof File)) {
    return jsonResponse(
      { ok: false, error: 'missing_file', message: 'Upload a single PDF file.' },
      { status: 400, headers: responseHeaders },
    );
  }

  try {
    const { resumeText } = await parsePdfResume({
      bytes: new Uint8Array(await uploadedFile.arrayBuffer()),
      fileName: uploadedFile.name,
      mimeType: uploadedFile.type,
    });

    return jsonResponse({ ok: true, resumeText }, { headers: responseHeaders });
  } catch (error) {
    if (error instanceof ResumeParseError) {
      return jsonResponse(
        {
          ok: false,
          error: error.code,
          message: error.message,
        },
        { status: 400, headers: responseHeaders },
      );
    }

    return jsonResponse(
      {
        ok: false,
        error: 'parse_failed',
        message: 'We could not read text from that PDF. Try another file.',
      },
      { status: 500, headers: responseHeaders },
    );
  }
};
