export function jsonResponse(body: unknown, init?: ResponseInit): Response {
  const status = init?.status ?? 200;
  const headers = new Headers(init?.headers);
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  let payload: string;
  try {
    payload = JSON.stringify(body);
  } catch {
    payload = JSON.stringify({ ok: false, error: 'Internal Server Error' });
    if (!init?.status) {
      return new Response(payload, { status: 500, headers });
    }
  }

  return new Response(payload, {
    ...init,
    status,
    headers,
  });
}
